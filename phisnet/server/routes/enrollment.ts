import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { isAdmin, isAuthenticated, hashPassword } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { acceptInviteSchema, rolesSchema, userRolesSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendEnrollmentInviteEmail, sendInviteAcceptedEmail } from "../email";
import { NotificationService } from "../services/notification-service";

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Hash invite tokens with SHA-256 for deterministic lookup (no need for slow password hash)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Rate limiting for accept endpoint
const acceptAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const attempts = acceptAttempts.get(identifier);
  
  if (!attempts || now > attempts.resetAt) {
    acceptAttempts.set(identifier, { count: 1, resetAt: now + ATTEMPT_WINDOW });
    return true;
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  attempts.count++;
  return true;
}

export function registerEnrollmentRoutes(app: Express) {
  // Admin: create one or more invites
  app.post("/api/admin/enroll/invite", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const emailsRaw = (req.body?.emails || req.body?.email) as string[] | string | undefined;
      if (!emailsRaw) return res.status(400).json({ message: "Provide email or emails[]" });
      const emails = Array.isArray(emailsRaw) ? emailsRaw : [emailsRaw];

      if (!req.user?.organizationId) return res.status(400).json({ message: "Missing organization context" });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const success: any[] = [];
      const failed: any[] = [];

      for (const email of emails) {
        try {
          const trimmedEmail = String(email).trim().toLowerCase();
          if (!trimmedEmail) continue;

          const token = generateInviteToken();
          const hashedToken = await hashToken(token);
          const invite = await storage.createUserInvite({
            email: trimmedEmail,
            organizationId: req.user.organizationId,
            invitedByUserId: req.user.id,
            token: hashedToken,
            expiresAt,
            createdAt: new Date(),
            acceptedAt: null as any,
          } as any);

          // Send invitation email with unhashed token
          const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
          const inviteUrl = `${baseUrl}/api/enroll/accept?token=${encodeURIComponent(token)}`;
          await sendEnrollmentInviteEmail({
            toEmail: invite.email,
            organizationName: req.user.organizationName,
            inviteUrl,
          });

          success.push({ id: invite.id, email: invite.email, expiresAt: invite.expiresAt, token, inviteUrl });
        } catch (err) {
          console.error(`Failed to create invite for ${email}:`, err);
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
      console.error("Invite error:", err);
      res.status(500).json({ message: "Failed to create invites" });
    }
  });

  // Admin: list invites
  app.get("/api/admin/enroll/invites", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.user?.organizationId) return res.status(400).json({ message: "Missing organization context" });
      const invites = await storage.listUserInvites(req.user.organizationId);
      res.json(invites);
    } catch (err) {
      console.error("List invites error:", err);
      res.status(500).json({ message: "Failed to list invites" });
    }
  });

  // Admin: delete/revoke invite
  app.delete("/api/admin/enroll/invites/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.user?.organizationId) return res.status(400).json({ message: "Missing organization context" });
      const inviteId = Number(req.params.id);
      if (!Number.isInteger(inviteId)) return res.status(400).json({ message: "Invalid invite ID" });

      // Get invite and verify ownership
      const invites = await storage.listUserInvites(req.user.organizationId);
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) return res.status(404).json({ message: "Invite not found" });

      // Security: Cannot delete accepted invites
      if (invite.acceptedAt) {
        return res.status(400).json({ message: "Cannot delete accepted invites" });
      }

      const deleted = await storage.deleteUserInvite(inviteId);
      if (!deleted) return res.status(500).json({ message: "Failed to delete invite" });

      res.json({ message: "Invite deleted successfully" });
    } catch (err) {
      console.error("Delete invite error:", err);
      res.status(500).json({ message: "Failed to delete invite" });
    }
  });

  // Admin: resend invite (regenerate token and extend expiry)
  app.post("/api/admin/enroll/invites/:id/resend", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.user?.organizationId) return res.status(400).json({ message: "Missing organization context" });
      const inviteId = Number(req.params.id);
      if (!Number.isInteger(inviteId)) return res.status(400).json({ message: "Invalid invite ID" });

      // Get invite and verify ownership
      const invites = await storage.listUserInvites(req.user.organizationId);
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) return res.status(404).json({ message: "Invite not found" });

      // Security: Cannot resend accepted invites
      if (invite.acceptedAt) {
        return res.status(400).json({ message: "Cannot resend accepted invites" });
      }

      // Generate new token and extend expiry
      const newToken = generateInviteToken();
      const hashedToken = hashToken(newToken);
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updatedInvite = await storage.resendUserInvite(inviteId, hashedToken, newExpiry);
      if (!updatedInvite) return res.status(500).json({ message: "Failed to resend invite" });

      // Send new invitation email
      const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
      const inviteUrl = `${baseUrl}/api/enroll/accept?token=${encodeURIComponent(newToken)}`;
      await sendEnrollmentInviteEmail({
        toEmail: updatedInvite.email,
        organizationName: req.user.organizationName,
        inviteUrl,
      });

      res.json({ message: "Invite resent successfully", token: newToken, inviteUrl, expiresAt: newExpiry });
    } catch (err) {
      console.error("Resend invite error:", err);
      res.status(500).json({ message: "Failed to resend invite" });
    }
  });

  // Public: GET accept (renders a minimal HTML form)
  app.get("/api/enroll/accept", async (req: Request, res: Response) => {
    try {
      const token = String(req.query.token || "");
      if (!token) return res.status(400).send(`<p>Missing token.</p>`);
      
      // Rate limiting by IP
      const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').split(':').pop() || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).send(`<p>Too many attempts. Please try again in 15 minutes.</p>`);
      }
      
      const invite = await storage.findUserInviteByToken(token);
      if (!invite) return res.status(400).send(`<p>Invalid or expired invite.</p>`);
      const loginUrl = invite.roleType === "OrgAdmin" ? "/auth?mode=org-admin" : "/auth";
      if (invite.acceptedAt) return res.status(200).send(`<p>Invite already accepted. You can log in now. <a href="${loginUrl}">Go to Login</a></p>`);
      if (new Date() > new Date(invite.expiresAt)) return res.status(400).send(`<p>Invite expired. Ask your admin to re-invite you.</p>`);

      // Accept form with styling similar to app UI
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Accept Invitation  PhishNet</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #0f172a;
        --card-bg: #0b1120;
        --border: #1e293b;
        --text: #e5e7eb;
        --muted: #9ca3af;
        --primary: #f97316;
        --primary-hover: #ea580c;
        --input-bg: #020617;
        --input-border: #1f2937;
        --error: #f97373;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #1e293b, #020617);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .shell {
        width: 100%;
        max-width: 480px;
      }
      .brand {
        text-align: center;
        margin-bottom: 16px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        font-size: 12px;
        color: var(--muted);
      }
      .card {
        background: var(--card-bg);
        border-radius: 12px;
        border: 1px solid var(--border);
        box-shadow: 0 20px 40px rgba(15,23,42,0.7);
        padding: 24px 24px 28px;
      }
      h1 {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .subtitle {
        margin: 0 0 20px;
        font-size: 14px;
        color: var(--muted);
      }
      .field {
        margin-bottom: 14px;
      }
      .label {
        display: block;
        font-size: 13px;
        margin-bottom: 4px;
        color: var(--muted);
      }
      input[type="text"],
      input[type="password"] {
        width: 100%;
        padding: 9px 11px;
        border-radius: 8px;
        border: 1px solid var(--input-border);
        background: var(--input-bg);
        color: var(--text);
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
      }
      input::placeholder {
        color: #6b7280;
      }
      input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 1px rgba(249,115,22,0.45);
      }
      button {
        margin-top: 4px;
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: #111827;
        background: var(--primary);
        cursor: pointer;
        transition: background-color 0.15s, transform 0.05s, box-shadow 0.15s;
        box-shadow: 0 10px 25px rgba(249,115,22,0.35);
      }
      button:hover {
        background: var(--primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 14px 30px rgba(249,115,22,0.45);
      }
      button:active {
        transform: translateY(0);
        box-shadow: 0 8px 18px rgba(249,115,22,0.35);
      }
      .footer {
        margin-top: 12px;
        text-align: center;
        font-size: 12px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="brand">PhishNet Enrollment</div>
      <div class="card">
        <h1>Accept Invitation</h1>
        <p class="subtitle">Set your name and password to activate your account.</p>
        <form method="POST" action="/api/enroll/accept">
          <input type="hidden" name="token" value="${encodeURIComponent(token)}" />
          <div class="field">
            <label class="label" for="firstName">First name</label>
            <input id="firstName" name="firstName" type="text" required placeholder="Jane" />
          </div>
          <div class="field">
            <label class="label" for="lastName">Last name</label>
            <input id="lastName" name="lastName" type="text" required placeholder="Doe" />
          </div>
          <div class="field">
            <label class="label" for="password">Password</label>
            <input id="password" name="password" type="password" minlength="8" required placeholder="Minimum 8 characters" />
          </div>
          <button type="submit">Activate Account</button>
          <div class="footer">Already have an account? <a href="${loginUrl}" style="color: #FF8000; text-decoration: none;">Go to Login</a></div>
        </form>
      </div>
    </div>
  </body>
</html>`);
    } catch (err) {
      console.error("Accept invite GET error:", err);
      res.status(500).send(`<p>Server error. Try again later.</p>`);
    }
  });

  // Public: POST accept (JSON or form)
  app.post("/api/enroll/accept", async (req: Request, res: Response) => {
    try {
      // Rate limiting by IP
      const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').split(':').pop() || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ message: "Too many attempts. Please try again in 15 minutes." });
      }
      
      const body = {
        token: (req.body?.token ?? req.query?.token) as string,
        firstName: (req.body?.firstName ?? req.query?.firstName) as string,
        lastName: (req.body?.lastName ?? req.query?.lastName) as string,
        password: (req.body?.password ?? req.query?.password) as string,
      };
      try {
        acceptInviteSchema.parse(body);
      } catch (e) {
        if (e instanceof z.ZodError) {
          return res.status(400).json({ message: "Validation failed", errors: e.errors });
        }
        throw e;
      }

      const invite = await storage.findUserInviteByToken(body.token);
      if (!invite) return res.status(400).json({ message: "Invalid or expired invite" });
      if (invite.acceptedAt) return res.status(400).json({ message: "This invite has already been used" });
      if (new Date() > new Date(invite.expiresAt)) return res.status(400).json({ message: "Invite expired" });

      // If a user already exists with this email
      const existing = await storage.getUserByEmail(invite.email);
      if (existing && existing.organizationId !== invite.organizationId) {
        // Single-tenant user model: cannot move user between organizations automatically.
        return res.status(409).json({ 
          message: "Email already registered under a different organization. Contact an administrator." 
        });
      }

      if (existing && existing.organizationId === invite.organizationId) {
        await storage.updateUser(existing.id, {
          firstName: body.firstName,
          lastName: body.lastName,
          password: await hashPassword(body.password),
          isActive: true,
          updatedAt: new Date(),
        } as any);
        
        // Assign role based on invite type
        if (invite.roleType === "Admin") {
          // Admin invite - elevate to global admin
          try { await storage.updateUser(existing.id, { isAdmin: true } as any); } catch (e) { console.warn('Admin elevation failed:', e); }
        } else if (invite.roleType === "OrgAdmin") {
          // Org admin invite - assign OrgAdmin role
          const [orgAdminRole] = await db.select({ id: rolesSchema.id })
            .from(rolesSchema)
            .where(eq(rolesSchema.name, 'OrgAdmin'));
          
          if (orgAdminRole) {
            try {
              await db.insert(userRolesSchema).values({
                userId: existing.id,
                roleId: orgAdminRole.id,
              });
              console.log(`✅ Assigned OrgAdmin role to existing user ${existing.id}`);
            } catch (e: any) {
              // Check if it's a duplicate key error (already has the role)
              if (e?.code !== '23505') {
                console.error('Role assignment failed:', e);
              }
            }
          } else {
            console.error('❌ OrgAdmin role not found in database!');
          }
        } else {
          // Regular employee invite - assign User role
          const [userRole] = await db.select({ id: rolesSchema.id })
            .from(rolesSchema)
            .where(eq(rolesSchema.name, 'User'));
          
          if (userRole) {
            try {
              await db.insert(userRolesSchema).values({
                userId: existing.id,
                roleId: userRole.id,
              });
              console.log(`✅ Assigned User role to existing employee ${existing.id}`);
            } catch (e: any) {
              if (e?.code !== '23505') {
                console.error('User role assignment failed:', e);
              }
            }
          } else {
            console.error('❌ User role not found in database!');
          }
        }
      } else if (!existing) {
        try {
          // Create a new user (employee or org-admin based on invite type)
          const newUser = await storage.createUser({
            email: invite.email,
            password: await hashPassword(body.password),
            firstName: body.firstName,
            lastName: body.lastName,
            isAdmin: invite.roleType === 'Admin',
            isActive: true,
            organizationId: invite.organizationId,
            organizationName: (await storage.getOrganization(invite.organizationId))?.name || "None",
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          // Assign role based on invite type
          if (invite.roleType === "OrgAdmin") {
            // Org admin invite
            const [orgAdminRole] = await db.select({ id: rolesSchema.id })
              .from(rolesSchema)
              .where(eq(rolesSchema.name, 'OrgAdmin'));
            
            if (orgAdminRole) {
              try {
                await db.insert(userRolesSchema).values({
                  userId: newUser.id,
                  roleId: orgAdminRole.id,
                });
                console.log(`✅ Assigned OrgAdmin role to new user ${newUser.id}`);
              } catch (e: any) {
                if (e?.code !== '23505') {
                  console.error('Role assignment failed:', e);
                }
              }
            } else {
              console.error('❌ OrgAdmin role not found in database!');
            }
          } else if (invite.roleType !== "Admin") {
            // Regular employee invite - assign User role
            const [userRole] = await db.select({ id: rolesSchema.id })
              .from(rolesSchema)
              .where(eq(rolesSchema.name, 'User'));
            
            if (userRole) {
              try {
                await db.insert(userRolesSchema).values({
                  userId: newUser.id,
                  roleId: userRole.id,
                });
                console.log(`✅ Assigned User role to new employee ${newUser.id}`);
              } catch (e: any) {
                if (e?.code !== '23505') {
                  console.error('User role assignment failed:', e);
                }
              }
            } else {
              console.error('❌ User role not found in database!');
            }
          }
        } catch (createErr: any) {
          if (createErr?.code === '23505') {
            return res.status(409).json({ message: 'Email already registered. Contact an administrator.' });
          }
          throw createErr;
        }
      }

      await storage.markUserInviteAccepted(invite.id);

      // Fetch admins to optionally email about acceptance based on preferences
      try {
        const orgUsers = await storage.listUsers(invite.organizationId);
        const admins = (orgUsers || []).filter(u => (u as any).isAdmin);
        for (const admin of admins) {
          const prefs: any = await NotificationService.getPreferences(admin.id);
            // Require both global emailNotifications and inviteEmail to be true
          if (prefs?.emailNotifications !== false && prefs?.inviteEmail !== false) {
            await sendInviteAcceptedEmail({
              toEmail: admin.email,
              organizationName: (await storage.getOrganization(invite.organizationId))?.name || 'PhishNet',
              userFullName: `${body.firstName} ${body.lastName}`.trim(),
              invitedEmail: invite.email,
            });
          }
        }
      } catch (emailErr) {
        console.error('Failed sending invite accepted admin emails:', emailErr);
      }

      // Create organization-wide notification that an invite was accepted
      try {
        await NotificationService.createOrganizationNotification({
          organizationId: invite.organizationId,
          type: "invite_accepted",
          title: "Invitation accepted",
          message: `${body.firstName} ${body.lastName} has accepted an invitation (${invite.email}).`,
          priority: "medium",
          actionUrl: "/admin/enroll",
        });
      } catch (notifyErr) {
        console.error("Failed to create invite accepted notification:", notifyErr);
      }

      // Respond with success and a styled page + link to login
      const inviteForLink = await storage.findUserInviteByToken(body.token);
      const successLoginUrl = inviteForLink?.roleType === 'OrgAdmin' ? '/auth?mode=org-admin' : '/auth';
      return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Account Activated  PhishNet</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --bg: #0f172a;
        --card-bg: #0b1120;
        --border: #1e293b;
        --text: #e5e7eb;
        --muted: #9ca3af;
        --primary: #f97316;
        --primary-hover: #ea580c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #1e293b, #020617);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .shell {
        width: 100%;
        max-width: 440px;
      }
      .brand {
        text-align: center;
        margin-bottom: 16px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        font-size: 12px;
        color: var(--muted);
      }
      .card {
        background: var(--card-bg);
        border-radius: 12px;
        border: 1px solid var(--border);
        box-shadow: 0 20px 40px rgba(15,23,42,0.7);
        padding: 28px 26px 30px;
        text-align: center;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .subtitle {
        margin: 0 0 22px;
        font-size: 14px;
        color: var(--muted);
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(34,197,94,0.1);
        color: #4ade80;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 10px;
      }
      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
        padding: 10px 20px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
        letter-spacing: 0.02em;
        color: #111827;
        background: var(--primary);
        box-shadow: 0 10px 25px rgba(249,115,22,0.35);
        transition: background-color 0.15s, transform 0.05s, box-shadow 0.15s;
      }
      a.button:hover {
        background: var(--primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 14px 30px rgba(249,115,22,0.45);
      }
      a.button:active {
        transform: translateY(0);
        box-shadow: 0 8px 18px rgba(249,115,22,0.35);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="brand">PhishNet Enrollment</div>
      <div class="card">
        <div class="pill">Account Activated</div>
        <h1>You're all set!</h1>
        <p class="subtitle">Your account has been activated. You can now sign in using your new password.</p>
        <a href="${successLoginUrl}" class="button">Go to Login</a>
      </div>
    </div>
  </body>
</html>`);
    } catch (err) {
      console.error("Accept invite POST error:", err);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });
}
