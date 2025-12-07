import type { Express } from 'express';
import { isAuthenticated, hasOrganization, isAdmin, hashPassword, comparePasswords } from '../auth';
import { storage } from '../storage';
import { db } from '../db';
import { users, rolesSchema, userRolesSchema, DEFAULT_ROLES } from '@shared/schema';
import { AuditService } from '../services/audit.service';
import { eq } from 'drizzle-orm';
import multer from 'multer';

const upload = multer();

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerUserRoutes(app: Express) {
  // Update user profile
  app.put("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const allowedFields = ['firstName', 'lastName', 'position', 'bio'];
      const updateData: Partial<Express.User> = {};
      
      // Only allow specific fields to be updated
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field as keyof Express.User] = req.body[field];
        }
      }
      
      const updatedUser = await storage.updateUser(req.user.id, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });
  
  // Change password
  app.post("/api/user/change-password", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Get the user with password (for verification)
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
          message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character" 
        });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password
      const updatedUser = await storage.updateUser(req.user.id, { 
        password: hashedPassword,
        failedLoginAttempts: 0,
        accountLocked: false,
        accountLockedUntil: null
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  
  // Upload profile picture
  app.post("/api/user/profile-picture", isAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
      assertUser(req.user);
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Convert image to base64 for storage
      const profilePicture = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      const updatedUser = await storage.updateUser(req.user.id, { profilePicture });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status(500).json({ message: "Failed to update profile picture" });
    }
  });
  
  // List all users in organization
  app.get("/api/users", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      // Ensure default roles are seeded
      try {
        const existingRole = await db.select({ id: rolesSchema.id }).from(rolesSchema).limit(1);
        if (existingRole.length === 0) {
          for (const r of DEFAULT_ROLES) {
            try {
              await db.insert(rolesSchema).values({
                name: r.name,
                description: r.description,
                permissions: Array.isArray((r as any).permissions) ? (r as any).permissions : (r as any).permissions?.permissions || []
              } as any);
            } catch {}
          }
        }
      } catch (e) {
        console.error('Role seeding check failed:', e);
      }

      const userList = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        profilePicture: users.profilePicture,
        createdAt: users.createdAt,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.organizationId, req.user.organizationId));
      
      // Get roles for each user
      const usersWithRoles = await Promise.all(
        userList.map(async (user) => {
          let userRoles = await db.select({
            id: rolesSchema.id,
            name: rolesSchema.name,
            description: rolesSchema.description,
            permissions: rolesSchema.permissions,
          })
          .from(userRolesSchema)
          .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
          .where(eq(userRolesSchema.userId, user.id));

          if (userRoles.length === 0 && (user.isAdmin || user.email.toLowerCase() === 'admin@phishnet.com')) {
            // Auto-assign Admin role if missing
            const [adminRole] = await db.select({ id: rolesSchema.id, name: rolesSchema.name, description: rolesSchema.description, permissions: rolesSchema.permissions })
              .from(rolesSchema)
              .where(eq(rolesSchema.name, 'Admin'));
            if (adminRole) {
              try {
                await db.insert(userRolesSchema).values({ userId: user.id, roleId: adminRole.id });
                userRoles.push(adminRole);
              } catch (e) {
                console.warn('Role auto-assign duplicate or race condition:', e);
              }
            }
          }
          
          return {
            ...user,
            roles: userRoles,
          };
        })
      );
      
      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Create a new user (Admin only)
  app.post("/api/users", isAuthenticated, hasOrganization, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const { firstName, lastName, email, password, roleId, isActive } = req.body;
      
      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      const [newUser] = await db.insert(users).values({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        isActive: isActive ?? true,
        organizationId: req.user.organizationId,
      }).returning();
      
      // Assign roles
      if (roleId) {
        await db.insert(userRolesSchema).values({
          userId: newUser.id,
          roleId: roleId
        });
      } else {
        // If no explicit role selected, default to "User" role for employees
        const [userRole] = await db
          .select({ id: rolesSchema.id })
          .from(rolesSchema)
          .where(eq(rolesSchema.name, 'User'))
          .limit(1);

        if (userRole) {
          await db.insert(userRolesSchema).values({
            userId: newUser.id,
            roleId: userRole.id,
          });
        }
      }
      
      // Audit log user creation
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "user.create",
        resource: "user",
        resourceId: newUser.id,
        metadata: { email: newUser.email, roleId },
      }).catch((err) => console.error("[Audit] Failed to log user creation:", err));
      
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  // Update a user (Admin only)
  app.put("/api/users/:id", isAuthenticated, hasOrganization, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const userId = Number.parseInt(req.params.id, 10);
      const { firstName, lastName, email, isActive, roleId } = req.body;
      
      // Check user belongs to same organization
      const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!existingUser || existingUser.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update user
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Update role if provided
      if (roleId !== undefined) {
        await db.delete(userRolesSchema).where(eq(userRolesSchema.userId, userId));
        if (roleId) {
          await db.insert(userRolesSchema).values({
            userId,
            roleId
          });
        }
      }
      
      // Audit log user update
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "user.update",
        resource: "user",
        resourceId: userId,
        metadata: { email: updatedUser?.email, changes: updateData, roleId },
      }).catch((err) => console.error("[Audit] Failed to log user update:", err));
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user" });
    }
  });

  // Delete a user (Admin only)
  app.delete("/api/users/:id", isAuthenticated, hasOrganization, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const userId = Number.parseInt(req.params.id, 10);
      
      // Check user belongs to same organization
      const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!existingUser || existingUser.organizationId !== req.user.organizationId) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't allow deleting yourself
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Audit log user deletion
      AuditService.log({
        context: {
          userId: req.user.id,
          organizationId: req.user.organizationId,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent"),
        },
        action: "user.delete",
        resource: "user",
        resourceId: userId,
        metadata: { email: existingUser.email },
      }).catch((err) => console.error("[Audit] Failed to log user deletion:", err));
      
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  // Get roles (with automatic seeding if empty)
  app.get("/api/roles", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      let roles = await db.select({
        id: rolesSchema.id,
        name: rolesSchema.name,
        description: rolesSchema.description,
        permissions: rolesSchema.permissions,
      }).from(rolesSchema);

      if (!roles || roles.length === 0) {
        // Seed default roles if table empty
        for (const r of DEFAULT_ROLES) {
          try {
            await db.insert(rolesSchema).values({
              name: r.name,
              description: r.description,
              permissions: Array.isArray((r as any).permissions) ? (r as any).permissions : (r as any).permissions?.permissions || []
            } as any);
          } catch (e) {
            console.warn('Role seed duplicate or race condition:', e);
          }
        }
        roles = await db.select({
          id: rolesSchema.id,
          name: rolesSchema.name,
          description: rolesSchema.description,
          permissions: rolesSchema.permissions,
        }).from(rolesSchema);
      }

      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Error fetching roles" });
    }
  });
}
