import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { isAdmin, isAuthenticated, hashPassword } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { organizations, rolesSchema, userRolesSchema, userInvites, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { sendEnrollmentInviteEmail } from "../email";

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function registerOrganizationManagementRoutes(app: Express) {
  // List all organizations (global admin only)
  app.get("/api/admin/organizations", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const orgs = await storage.listOrganizations();
      res.json(orgs);
    } catch (error) {
      console.error("Error listing organizations:", error);
      res.status(500).json({ message: "Failed to list organizations" });
    }
  });

  // Create new organization (global admin only)
  app.post("/api/admin/organizations", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, dataRetentionDays, twoFactorRequired } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Organization name is required" });
      }

      const newOrg = await storage.createOrganization({
        name,
        dataRetentionDays: dataRetentionDays || null,
        twoFactorRequired: twoFactorRequired || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      res.status(201).json(newOrg);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  // Update organization (global admin only)
  app.put("/api/admin/organizations/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const { name, dataRetentionDays, twoFactorRequired } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (dataRetentionDays !== undefined) updateData.dataRetentionDays = dataRetentionDays;
      if (twoFactorRequired !== undefined) updateData.twoFactorRequired = twoFactorRequired;

      const updatedOrg = await storage.updateOrganization(orgId, updateData);
      
      if (!updatedOrg) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json(updatedOrg);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Delete organization (global admin only)
  app.delete("/api/admin/organizations/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      
      await storage.deleteOrganization(orgId);
      res.json({ message: "Organization deleted successfully" });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ message: "Failed to delete organization" });
    }
  });

  // Invite org admin (global admin only)
  app.post("/api/admin/organizations/:id/invite-admin", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const organizationId = parseInt(req.params.id);
      const emailsRaw = (req.body?.emails || req.body?.email) as string[] | string | undefined;
      
      if (!emailsRaw) {
        return res.status(400).json({ message: "Provide email or emails[]" });
      }

      const emails = Array.isArray(emailsRaw) ? emailsRaw : [emailsRaw];
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const success: any[] = [];
      const failed: any[] = [];

      // Get organization for email
      const org = await storage.getOrganization(organizationId);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      for (const email of emails) {
        try {
          const trimmedEmail = String(email).trim().toLowerCase();
          if (!trimmedEmail) continue;

          const token = generateInviteToken();
          const hashedToken = hashToken(token);
          
          const invite = await storage.createUserInvite({
            email: trimmedEmail,
            organizationId,
            invitedByUserId: req.user!.id,
            token: hashedToken,
            roleType: "OrgAdmin", // Mark this as org-admin invite
            expiresAt,
            createdAt: new Date(),
            acceptedAt: null as any,
          } as any);

          // Send invitation email
          const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
          const inviteUrl = `${baseUrl}/api/enroll/accept?token=${encodeURIComponent(token)}`;
          
          await sendEnrollmentInviteEmail({
            toEmail: invite.email,
            organizationName: org.name,
            inviteUrl,
          });

          success.push({ id: invite.id, email: invite.email, expiresAt: invite.expiresAt, token, inviteUrl });
        } catch (err) {
          console.error(`Failed to create org-admin invite for ${email}:`, err);
          failed.push({ email: String(email).trim(), error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      res.status(201).json({ 
        message: `${success.length} invitation(s) sent successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
        success, 
        failed,
        total: emails.length,
        successCount: success.length,
        failedCount: failed.length
      });
    } catch (err) {
      console.error("Org-admin invite error:", err);
      res.status(500).json({ message: "Failed to create invites" });
    }
  });

  // List org-admin invites (global admin only)
  app.get("/api/admin/org-admin-invites", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Get all invites where roleType = 'OrgAdmin' across all organizations
      const allInvites = await db.select()
        .from(userInvites)
        .where(eq(userInvites.roleType, "OrgAdmin"));
      
      res.json(allInvites);
    } catch (err) {
      console.error("List org-admin invites error:", err);
      res.status(500).json({ message: "Failed to list invites" });
    }
  });

  // Delete org-admin invite (global admin only)
  app.delete("/api/admin/org-admin-invites/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const inviteId = Number(req.params.id);
      if (!Number.isInteger(inviteId)) {
        return res.status(400).json({ message: "Invalid invite ID" });
      }

      const deleted = await storage.deleteUserInvite(inviteId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete invite" });
      }

      res.json({ message: "Invite deleted successfully" });
    } catch (err) {
      console.error("Delete org-admin invite error:", err);
      res.status(500).json({ message: "Failed to delete invite" });
    }
  });

  // Resend org-admin invite (global admin only)
  app.post("/api/admin/org-admin-invites/:id/resend", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const inviteId = Number(req.params.id);
      if (!Number.isInteger(inviteId)) {
        return res.status(400).json({ message: "Invalid invite ID" });
      }

      // Get the invite first
      const [invite] = await db.select().from(userInvites).where(eq(userInvites.id, inviteId));
      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }

      if (invite.acceptedAt) {
        return res.status(400).json({ message: "Cannot resend accepted invites" });
      }

      // Generate new token and extend expiry
      const newToken = generateInviteToken();
      const hashedToken = hashToken(newToken);
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updatedInvite = await storage.resendUserInvite(inviteId, hashedToken, newExpiry);
      if (!updatedInvite) {
        return res.status(500).json({ message: "Failed to resend invite" });
      }

      // Get organization for email
      const org = await storage.getOrganization(invite.organizationId);

      // Send new invitation email
      const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
      const inviteUrl = `${baseUrl}/api/enroll/accept?token=${encodeURIComponent(newToken)}`;
      
      await sendEnrollmentInviteEmail({
        toEmail: updatedInvite.email,
        organizationName: org?.name || "PhishNet",
        inviteUrl,
      });

      res.json({ message: "Invite resent successfully", token: newToken, inviteUrl, expiresAt: newExpiry });
    } catch (err) {
      console.error("Resend org-admin invite error:", err);
      res.status(500).json({ message: "Failed to resend invite" });
    }
  });

  // List all org-admin users (global admin only)
  app.get("/api/admin/org-admins", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      // Get all users with OrgAdmin role
      const orgAdmins = await db.select({
        userId: userRolesSchema.userId,
        roleId: userRolesSchema.roleId,
        roleName: rolesSchema.name,
      })
      .from(userRolesSchema)
      .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
      .where(eq(rolesSchema.name, 'OrgAdmin'));

      // Fetch full user details
      const userIds = orgAdmins.map(oa => oa.userId);
      const users = await Promise.all(
        userIds.map(id => storage.getUser(id))
      );

      // Filter out null and return user details
      const validUsers = users.filter(u => u !== null).map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        organizationId: u.organizationId,
        organizationName: u.organizationName,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));

      res.json(validUsers);
    } catch (err) {
      console.error("List org-admins error:", err);
      res.status(500).json({ message: "Failed to list org-admins" });
    }
  });

  // Delete org-admin user (global admin only)
  app.delete("/api/admin/org-admins/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isInteger(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Verify user exists and has OrgAdmin role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has OrgAdmin role
      const userRole = await db.select()
        .from(userRolesSchema)
        .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
        .where(sql`${userRolesSchema.userId} = ${userId} AND ${rolesSchema.name} = 'OrgAdmin'`);

      if (userRole.length === 0) {
        return res.status(400).json({ message: "User is not an OrgAdmin" });
      }

      // Delete the user (cascades will remove role assignments)
      await storage.deleteUser(userId);

      // Also clean up any outstanding invites for this admin's email
      if (user.email) {
        try {
          const deletedCount = await (storage as any).deleteUserInvitesByEmail?.(user.email.toLowerCase());
          if (deletedCount && deletedCount > 0) {
            console.log(`OrgAdmin delete: removed ${deletedCount} invite(s) for ${user.email}`);
          }
        } catch (inviteErr) {
          console.error("Failed to cleanup invites for deleted OrgAdmin:", inviteErr);
        }
      }

      res.json({ message: "OrgAdmin user deleted successfully" });
    } catch (err) {
      console.error("Delete org-admin error:", err);
      res.status(500).json({ message: "Failed to delete org-admin" });
    }
  });
}

