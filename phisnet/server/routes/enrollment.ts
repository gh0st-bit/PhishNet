import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { isAdmin, isAuthenticated, hashPassword } from "../auth";
import { storage } from "../storage";
import { acceptInviteSchema } from "@shared/schema";
import { z } from "zod";
import { sendEnrollmentInviteEmail } from "../email";

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function hashToken(token: string): Promise<string> {
  return await bcrypt.hash(token, 10);
}

async function verifyToken(token: string, hashedToken: string): Promise<boolean> {
  return await bcrypt.compare(token, hashedToken);
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
      const created: any[] = [];

      for (const email of emails) {
        const token = generateInviteToken();
        const hashedToken = await hashToken(token);
        const invite = await storage.createUserInvite({
          email: String(email).trim().toLowerCase(),
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

        created.push({ id: invite.id, email: invite.email, expiresAt: invite.expiresAt });
      }

      res.status(201).json({ message: "Invitations created", invites: created });
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
      if (invite.acceptedAt) return res.status(200).send(`<p>Invite already accepted. You can log in now. <a href="/auth">Go to Login</a></p>`);
      if (new Date() > new Date(invite.expiresAt)) return res.status(400).send(`<p>Invite expired. Ask your admin to re-invite you.</p>`);

      // Simple accept form
      res.status(200).send(`
        <html>
          <head><title>Accept Invitation</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 520px; margin: 40px auto;">
            <h2>Accept Invitation</h2>
            <p>Set your name and password to activate your account.</p>
            <form method="POST" action="/api/enroll/accept" style="display:flex;flex-direction:column;gap:8px;">
              <input type="hidden" name="token" value="${encodeURIComponent(token)}" />
              <input name="firstName" placeholder="First name" required />
              <input name="lastName" placeholder="Last name" required />
              <input type="password" name="password" placeholder="Password (min 8)" minlength="8" required />
              <button type="submit" style="background:#FF8000;color:#fff;padding:10px 14px;border:none;border-radius:4px;cursor:pointer;">Activate Account</button>
            </form>
          </body>
        </html>
      `);
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

      // If a user already exists with this email in same org, just activate and update basic info
      const existing = await storage.getUserByEmail(invite.email);
      if (existing && existing.organizationId === invite.organizationId) {
        await storage.updateUser(existing.id, {
          firstName: body.firstName,
          lastName: body.lastName,
          password: await hashPassword(body.password),
          isActive: true,
          updatedAt: new Date(),
        } as any);
      } else {
        // Create a new employee user (non-admin)
        await storage.createUser({
          email: invite.email,
          password: await hashPassword(body.password),
          firstName: body.firstName,
          lastName: body.lastName,
          isAdmin: false,
          isActive: true,
          organizationId: invite.organizationId,
          organizationName: (await storage.getOrganization(invite.organizationId))?.name || "None",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      await storage.markUserInviteAccepted(invite.id);

      // Respond with success and a link to login
      return res.status(200).send(`
        <html>
          <head><title>Account Activated</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #4caf50;">Success!</h1>
            <p>Your account has been activated. You can now log in.</p>
            <div style="margin-top: 30px;">
              <a href="/auth" style="background-color: #FF8000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Login</a>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Accept invite POST error:", err);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });
}
