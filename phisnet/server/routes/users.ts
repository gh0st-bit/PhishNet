import { randomUUID } from 'node:crypto';
import { putPrivateObject,deletePrivateObject,imageType } from '../services/object-store';
import { pool } from '../db';
import { publicUser } from '../public-user';
import type { Express } from 'express';
import { isAuthenticated, hasOrganization, isAdmin, isAdminOrOrgAdmin, hashPassword, comparePasswords, destroyUserSessions } from '../auth';
import { ROLE_PERMISSIONS } from '@shared/access-control';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import { users, rolesSchema, userRolesSchema, DEFAULT_ROLES } from '@shared/schema';
import { AuditService } from '../services/audit.service';
import { eq } from 'drizzle-orm';
import multer from 'multer';

const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}});

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
      
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      res.json(publicUser(updatedUser));
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
      // Sign out every other session; the current one stays signed in.
      await destroyUserSessions(req.user.id, req.sessionID);
      
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
      
      const type=imageType(req.file.buffer);const id=randomUUID();const key=`assets/${req.user.organizationId}/${id}.${type.extension}`;
      await putPrivateObject(key,req.file.buffer,type.mime);
      let updatedUser;
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO private_assets(id,organization_id,owner_user_id,object_key,mime_type,byte_length) VALUES($1,$2,$3,$4,$5,$6)',[id,req.user.organizationId,req.user.id,key,type.mime,req.file.size]);
        await client.query('UPDATE users SET profile_picture=$2,updated_at=now() WHERE id=$1 AND organization_id=$3',[req.user.id,`/api/assets/${id}`,req.user.organizationId]);
        await client.query('COMMIT');updatedUser=await storage.getUser(req.user.id);
      }catch(error){await client.query('ROLLBACK');await deletePrivateObject(key);throw error;}
      finally{client.release();}
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      res.json(publicUser(updatedUser));
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status((error as any).status||500).json({ message: (error as any).status?(error as Error).message:"Failed to update profile picture" });
    }
  });
  
  // List all users in organization
  app.get("/api/users", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const userList = await db.select({
        id: users.id,
        organizationId: users.organizationId,
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
  app.post("/api/users", isAuthenticated, hasOrganization, isAdminOrOrgAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const parsed = z.object({ firstName:z.string().trim().min(1), lastName:z.string().trim().min(1), email:z.string().email().transform(v=>v.toLowerCase().trim()), password:z.string().min(8), roleId:z.number().int().positive().optional(), isActive:z.boolean().optional() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({message:'Invalid user details', errors:parsed.error.issues});
      const { firstName, lastName, email, password, roleId, isActive } = parsed.data;
      const [role] = await db.select().from(rolesSchema).where(roleId ? eq(rolesSchema.id, roleId) : eq(rolesSchema.name, 'User'));
      if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role.name)) return res.status(400).json({message:'Choose a supported role'});
      if (role.name === 'Admin' && !req.user.isAdmin) return res.status(403).json({message:'Only a platform administrator can grant Admin'});
      
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
      const newUser = await db.transaction(async tx => {
      const [created] = await tx.insert(users).values({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        isActive: isActive ?? true,
        isAdmin: role.name === 'Admin',
        emailVerified: true,
        organizationId: req.user!.organizationId,
        organizationName: req.user!.organizationName,
      }).returning();
      await tx.insert(userRolesSchema).values({userId:created.id, roleId:role.id});
      return created;
      });
      
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
      
      res.status(201).json(publicUser(newUser));
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  // Update a user (Admin only)
  app.put("/api/users/:id", isAuthenticated, hasOrganization, isAdminOrOrgAdmin, async (req, res) => {
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
      const existingRoles = await db.select({name:rolesSchema.name}).from(userRolesSchema).innerJoin(rolesSchema,eq(rolesSchema.id,userRolesSchema.roleId)).where(eq(userRolesSchema.userId,userId));
      if (!req.user.isAdmin && (existingUser.isAdmin || existingRoles.some(r=>r.name==='Admin'))) return res.status(403).json({message:'Only a platform administrator can modify an Admin'});
      const role = roleId !== undefined ? (await db.select().from(rolesSchema).where(eq(rolesSchema.id,Number(roleId))))[0] : undefined;
      if (roleId !== undefined && (!role || !Object.hasOwn(ROLE_PERMISSIONS,role.name))) return res.status(400).json({message:'Choose a supported role'});
      if (role?.name === 'Admin' && !req.user.isAdmin) return res.status(403).json({message:'Only a platform administrator can grant Admin'});
      if (userId === req.user.id && (isActive === false || (role && !existingRoles.some(r=>r.name===role.name)))) return res.status(400).json({message:'Use another administrator to change your own role or disable your account'});
      
      // Update user
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (role) updateData.isAdmin = role.name === 'Admin';
      
      const updatedUser = await db.transaction(async tx => {
        const [updated] = await tx.update(users).set(updateData).where(eq(users.id,userId)).returning();
        if(role) {
          await tx.delete(userRolesSchema).where(eq(userRolesSchema.userId,userId));
          await tx.insert(userRolesSchema).values({userId,roleId:role.id});
        }
        return updated;
      });
      
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
      
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      res.json(publicUser(updatedUser));
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user" });
    }
  });

  // Delete a user (Admin only)
  app.delete("/api/users/:id", isAuthenticated, hasOrganization, isAdminOrOrgAdmin, async (req, res) => {
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
      const assigned = await db.select({name:rolesSchema.name}).from(userRolesSchema).innerJoin(rolesSchema,eq(rolesSchema.id,userRolesSchema.roleId)).where(eq(userRolesSchema.userId,userId));
      if (!req.user.isAdmin && (existingUser.isAdmin || assigned.some(r=>r.name==='Admin'))) return res.status(403).json({message:'Only a platform administrator can delete an Admin'});
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

      res.json(roles.filter(role => req.user!.isAdmin || role.name !== 'Admin').map(role=>({...role,permissions:ROLE_PERMISSIONS[role.name as keyof typeof ROLE_PERMISSIONS] || []})));
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Error fetching roles" });
    }
  });
}
