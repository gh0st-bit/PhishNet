import { requestDatabaseScope } from './database-context';
import { publicUser } from './public-user';
import { organizations, users } from '@shared/schema';
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { storage } from "./storage";
import { db,pool,controlPool } from "./db";
import { rolesSchema, userRolesSchema } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { User as SelectUser, userValidationSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import { z } from "zod";
import { appRole } from '@shared/access-control';
import { AuditService } from "./services/audit.service";
import { authLimiter, loginLimiter } from "./middleware/rate-limit";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { generatePasswordResetToken, verifyPasswordResetToken, sendPasswordResetEmail, generateEmailVerificationToken, verifyEmailVerificationToken, sendEmailVerificationEmail } from "./email";

// Maximum login attempts before account lockout
const MAX_LOGIN_ATTEMPTS = 10;
// Lockout time in milliseconds (30 minutes)
const LOCKOUT_TIME = 30 * 60 * 1000;
// Time window to reset failed attempts (24 hours)
const RESET_WINDOW = 24 * 60 * 60 * 1000;

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

const INVALID_CREDENTIALS = "Invalid email or password";
const APP_ORIGIN = new URL(process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).origin;

/** Removes a user's stored sessions (optionally keeping one), e.g. after a password change. */
export async function destroyUserSessions(userId: number, exceptSessionId?: string) {
  await controlPool.query(
    "DELETE FROM session WHERE (sess->'passport'->>'user')=$1::text AND ($2::text IS NULL OR sid<>$2::text)",
    [String(userId), exceptSessionId ?? null]
  );
}
// A well-formed hash of a random value, compared against when the email is unknown.
const DUMMY_PASSWORD_HASH = `${randomBytes(64).toString("hex")}.${randomBytes(32).toString("hex")}`;

async function authenticatedIdentity(user: SelectUser) {
  const rows = await db.select({ name: rolesSchema.name }).from(userRolesSchema)
    .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
    .where(eq(userRolesSchema.userId, user.id));
  const roles = rows.map(row => row.name);
  return { ...user, roles, isAdmin: Boolean(user.isAdmin || roles.includes('Admin')) };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(32).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) return false;
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

async function checkAccountLockStatus(user: SelectUser) {
  if (user.accountLocked && user.accountLockedUntil) {
    const now = new Date();
    const lockUntil = new Date(user.accountLockedUntil);
    
    if (now < lockUntil) {
      return {
        locked: true,
        message: `Account is locked. Try again after ${lockUntil.toLocaleString()}`
      };
    } else {
      await storage.updateUser(user.id, { 
        accountLocked: false,
        accountLockedUntil: null,
        failedLoginAttempts: 0
      });
      return { locked: false };
    }
  }
  
  if (user.lastFailedLogin && user.failedLoginAttempts > 0) {
    const lastAttempt = new Date(user.lastFailedLogin);
    const now = new Date();
    
    if (now.getTime() - lastAttempt.getTime() > RESET_WINDOW) {
      await storage.updateUser(user.id, {
        failedLoginAttempts: 0
      });
    }
  }
  
  return { locked: false };
}

async function recordFailedLoginAttempt(user: SelectUser) {
  const newAttemptCount = (user.failedLoginAttempts || 0) + 1;
  
  const updates: Partial<SelectUser> = {
    failedLoginAttempts: newAttemptCount,
    lastFailedLogin: new Date()
  };
  
  if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCKOUT_TIME);
    updates.accountLocked = true;
    updates.accountLockedUntil = lockUntil;
  }
  
  await storage.updateUser(user.id, updates);
  
  return newAttemptCount >= MAX_LOGIN_ATTEMPTS;
}

async function resetFailedLoginAttempts(userId: number) {
  await storage.updateUser(userId, {
    failedLoginAttempts: 0,
    lastFailedLogin: null,
    accountLocked: false,
    accountLockedUntil: null
  });
}

function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replaceAll("'", "''")
    .replaceAll(";", "")
    .replaceAll("--", "")
    .replaceAll("/*", "")
    .replaceAll("*/", "")
    .trim();
}

export function setupAuth(app: Express) {
  // Configure session with DATABASE-ONLY storage
  // Allow overriding secure cookie behavior for local testing of production build
  // If running a production build over plain HTTP (localhost), the cookie would be dropped when secure=true
  const forceInsecureCookie = process.env.ALLOW_INSECURE_COOKIES === 'true';
  const secureCookie = !forceInsecureCookie && process.env.NODE_ENV === 'production';

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'phishnet-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: secureCookie, // only true when production & not explicitly overridden
      maxAge: 30 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  const sessionMiddleware = session(sessionSettings);
  app.use(sessionMiddleware);
  app.set("sessionMiddleware", sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(requestDatabaseScope);

  // Configure static routes for uploaded files


  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {

          const user = await storage.getUserByEmail(email);

          if (!user) {
            // Spend the same hashing time as a real check so response timing does not reveal accounts.
            await comparePasswords(password, DUMMY_PASSWORD_HASH);
            return done(null, false, { message: INVALID_CREDENTIALS });
          }

          // Check if account is locked
          const lockStatus = await checkAccountLockStatus(user);
          if (lockStatus.locked) {
            return done(null, false, { message: lockStatus.message ?? "Account locked." });
          }

          const isValid = await comparePasswords(password, user.password);


          if (!isValid) {
            // Same message as an unknown email: attempt counts would confirm the account exists.
            await recordFailedLoginAttempt(user);
            return done(null, false, { message: INVALID_CREDENTIALS });
          }

          // Inactive status is only disclosed after the password is proven.
          // Disabled accounts cannot sign in, including administrators.
          if ((user as any).isActive === false) {
            return done(null, false, { message: "Account inactive. Please accept your invitation or contact your admin." });
          }

          await resetFailedLoginAttempts(user.id);
          return done(null, await authenticatedIdentity(user));
        } catch (error) {
          console.error('Login error:', error);
          return done(error instanceof Error ? error : new Error("Unknown error"));
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user?.isActive ? await authenticatedIdentity(user) : false);
    } catch (error) {
      done(error);
    }
  });

  // Tenant creation and owner assignment are atomic. Existing tenants require invitations.
  app.post('/api/register', authLimiter, async (req, res, next) => {
    try {
      const input = userValidationSchema.parse(req.body);
      const email = input.email.trim().toLowerCase();
      const name = input.organizationName?.trim();
      if (!name || name === 'None' || name.length > 200) return res.status(400).json({ message: 'Organization name is required' });
      const hashed = await hashPassword(input.password);
      const token = generateEmailVerificationToken({ id: 0, email } as SelectUser);
      const user = await db.transaction(async tx => {
        // Serialize equivalent organization registrations, including case variants.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${name.toLowerCase()}))`);
        const existing = await tx.select().from(organizations).where(sql`lower(${organizations.name}) = ${name.toLowerCase()}`);
        if (existing.length) throw Object.assign(new Error('Organization already exists. Request an invitation.'), { status: 409 });
        const [role] = await tx.select().from(rolesSchema).where(eq(rolesSchema.name,'OrgAdmin'));
        if (!role) throw new Error('Default roles require migration');
        const [org] = await tx.insert(organizations).values({ name, encryptionKey: randomBytes(32).toString('base64') }).returning();
        const [created] = await tx.insert(users).values({ email, firstName: input.firstName, lastName: input.lastName,
          password: hashed, organizationId: org.id, organizationName: name, isAdmin: false,
          emailVerified: false, emailVerificationToken: token, emailVerificationExpiry: new Date(Date.now()+86400000) }).returning();
        await tx.insert(userRolesSchema).values({ userId: created.id, roleId: role.id });
        return created;
      });
      await sendEmailVerificationEmail(user, `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/verify-email?token=${token}`);
      return res.status(201).json({ ...publicUser(user), message: 'Please verify your email before signing in.' });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.issues });
      if (error.code === '23505') return res.status(409).json({ message: 'Email already exists' });
      if (error.status) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  });

  // Login endpoint (with rate limiter: 10 failed attempts per 15 minutes)
  app.post("/api/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Authentication failed" });

      if(process.env.NODE_ENV==='production' && !user.emailVerified)return res.status(403).json({message:'Verify your email before signing in'});
      (req.session as any).pendingTwoFactorExpiresAt=Date.now()+5*60*1000;
      // Organization enforcement: if org requires 2FA but user not enabled, signal setup required
      const org = await storage.getOrganization(user.organizationId);
      const privilegedRoles=await db.select({name:rolesSchema.name}).from(userRolesSchema).innerJoin(rolesSchema,eq(userRolesSchema.roleId,rolesSchema.id)).where(eq(userRolesSchema.userId,user.id));
      const mandatoryMfa=Boolean(org?.twoFactorRequired)||(process.env.NODE_ENV==='production' && (user.isAdmin||privilegedRoles.some(role=>role.name==='OrgAdmin')));
      if (mandatoryMfa && !(user as any).twoFactorEnabled) {
        (req.session as any).pendingTwoFactorUserId = user.id;
        return res.status(200).json({ requiresTwoFactorSetup: true });
      }
      // If 2FA is enabled for this user, create a pending session and require second factor
      if ((user as any).twoFactorEnabled) {
        (req.session as any).pendingTwoFactorUserId = user.id;
        // Do NOT establish login session yet
        return res.status(200).json({ requiresTwoFactor: true });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.save(async (saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return next(saveErr);
          }
          AuditService.log({
            context: {
              userId: user.id,
              organizationId: user.organizationId,
              ip: req.ip || req.socket.remoteAddress,
              userAgent: req.get("user-agent"),
            },
            action: "user.login",
            resource: "auth",
            metadata: { email: user.email },
          }).catch((err) => console.error("[Audit] Failed to log login:", err));
          
          // Fetch roles before responding
          try {
            const rows = await db.select({ roleName: rolesSchema.name })
              .from(userRolesSchema)
              .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
              .where(eq(userRolesSchema.userId, user.id));
            const roles = rows.map((r) => r.roleName);
            const userWithoutPassword = publicUser(user);
            return res.status(200).json({ ...userWithoutPassword, roles });
          } catch (e) {
            console.error("Failed to fetch roles on login:", e);
            const userWithoutPassword = publicUser(user);
            return res.status(200).json({ ...userWithoutPassword, roles: [] });
          }
        });
      });
    })(req, res, next);
  });

  // Complete 2FA login: verify TOTP or backup code then establish session
  app.post('/api/login/2fa', authLimiter, async (req, res, next) => {
    try {
      const { token, backupCode } = req.body as { token?: string; backupCode?: string };
      const pendingId = (req.session as any).pendingTwoFactorUserId;
      if (!pendingId || !Number.isFinite(Number((req.session as any).pendingTwoFactorExpiresAt)) || Number((req.session as any).pendingTwoFactorExpiresAt)<Date.now()) return res.status(400).json({ message: 'No pending 2FA login. Sign in again.' });
      const storedUser = await storage.getUser(pendingId);
      const user = storedUser ? await authenticatedIdentity(storedUser) : undefined;
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!user.isActive) return res.status(403).json({ message: 'Account inactive' });
      if (!(user as any).twoFactorEnabled || !(user as any).twoFactorSecret) {
        return res.status(400).json({ message: '2FA not enabled' });
      }

      // Decrypt secret
      const { SecretsService } = await import('./services/secrets.service');
      const decrypted = await SecretsService.decrypt(user.organizationId, (user as any).twoFactorSecret);
      let success = false;
      let usedBackupIndex: number | null = null;

      if (token && /^\d{6}$/.test(token)) {
        const { TwoFactorService } = await import('./services/two-factor.service');
        const step = TwoFactorService.verifyTokenStep(decrypted, token);
        if (step !== null) {
          // Record the step atomically; a code from this step or earlier cannot be replayed.
          // The column is timestamp-without-zone holding UTC (as Drizzle writes it), so compare in UTC.
          const claimed = await pool.query("UPDATE users SET two_factor_verified_at=(to_timestamp($2::float8*30) AT TIME ZONE 'UTC') WHERE id=$1 AND (two_factor_verified_at IS NULL OR two_factor_verified_at<(to_timestamp($2::float8*30) AT TIME ZONE 'UTC')) RETURNING id", [user.id, step]);
          if (!claimed.rowCount) return res.status(401).json({ message: 'This code was already used. Wait for the next code.' });
          success = true;
        }
      } else if (backupCode) {
        const { TwoFactorService } = await import('./services/two-factor.service');
        const codes: string[] = (user as any).twoFactorBackupCodes || [];
        for (let i = 0; i < codes.length; i++) {
          if (await TwoFactorService.verifyBackupCode(codes[i], backupCode)) {
            success = true;
            usedBackupIndex = i;
            break;
          }
        }
      } else {
        return res.status(400).json({ message: 'Token or backupCode required' });
      }

      if (!success) return res.status(401).json({ message: 'Invalid 2FA credentials' });

      // Consume backup code if used
      if (usedBackupIndex !== null) {
        const codes: string[] = (user as any).twoFactorBackupCodes || [];
        const consumed=await pool.query("UPDATE users SET two_factor_backup_codes=array_remove(two_factor_backup_codes,$2) WHERE id=$1 AND $2=ANY(two_factor_backup_codes) RETURNING id",[user.id,codes[usedBackupIndex]]);
        if(!consumed.rowCount)return res.status(401).json({message:'Backup code has already been used'});
      }

      await storage.updateUser(user.id, { twoFactorVerifiedAt: new Date() } as any);
      delete (req.session as any).pendingTwoFactorUserId;

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.session.save(async (saveErr) => {
          if (saveErr) return next(saveErr);
          await AuditService.log({
            context: { userId: user.id, organizationId: user.organizationId, ip: req.ip || req.socket.remoteAddress, userAgent: req.get('user-agent') },
            action: 'user.login.2fa', resource: 'auth', metadata: { email: user.email }
          }).catch(()=>{});
          const userWithoutPassword = publicUser(user);
          try {
            const rows = await db.select({ roleName: rolesSchema.name })
              .from(userRolesSchema)
              .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
              .where(eq(userRolesSchema.userId, user.id));
            const roles = rows.map(r => r.roleName);
            res.status(200).json({ ...userWithoutPassword, roles });
          } catch (e) {
            console.error('Failed to fetch roles on 2FA login:', e);
            res.status(200).json({ ...userWithoutPassword, roles: [] });
          }
        });
      });
    } catch (e) {
      console.error('2FA login error', e);
      next(e);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    const user = req.user as any;
    
    req.logout((err) => {
      if (err) return next(err);
      
      // Audit log the logout
      if (user?.id && user?.organizationId) {
        AuditService.log({
          context: {
            userId: user.id,
            organizationId: user.organizationId,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.get("user-agent"),
          },
          action: "user.logout",
          resource: "auth",
          metadata: { email: user.email },
        }).catch((err) => console.error("[Audit] Failed to log logout:", err));
      }
      
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Fetch user's roles from database
    const userRoles = await db.select({
      roleName: rolesSchema.name,
      roleId: rolesSchema.id,
    })
    .from(userRolesSchema)
    .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
    .where(eq(userRolesSchema.userId, req.user.id));
    
    const userWithoutPassword = publicUser(req.user);
    res.json({
      ...userWithoutPassword,
      roles: userRoles.map(r => r.roleName),
    });
  });

  // Upload profile picture endpoint

  
  // Update user profile endpoint

  
  // Forgot password endpoint - initiates password reset flow
  app.post("/api/forgot-password", authLimiter, async (req, res) => {
    try {
      // Validate request data
      try {
        forgotPasswordSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationError.issues
          });
        }
      }
      
      // Sanitize email input
      const sanitizedEmail = sanitizeInput(req.body.email);

      // Find user by email
      const user = await storage.getUserByEmail(sanitizedEmail);

      // Identical response whether or not the account exists, and whether or not mail succeeds.
      const genericResponse = { message: "If an account exists with this email, a password reset link has been sent." };
      if (!user) {
        return res.status(200).json(genericResponse);
      }
      
      // Generate JWT token
      const token = generatePasswordResetToken(user);
      
  // Store token in database with expiry
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await storage.createPasswordResetToken({ userId: user.id, token, expiresAt } as any);
      
      // Build the link from configuration, never from the request Host header, which an
      // attacker controls and could use to send a victim's reset token to their own domain.
      const resetUrl = `${APP_ORIGIN}/reset-password/${token}`;

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(user, resetUrl);

      if (!emailSent) {
        console.error("Password reset email could not be sent", { userId: user.id });
      }

      res.status(200).json(genericResponse);
    } catch (error) {
      console.error("Error in forgot password flow:", error);
      res.status(500).json({ message: "An error occurred processing your request" });
    }
  });
  
  // Reset password endpoint - completes password reset with new password
  app.post("/api/reset-password", authLimiter, async (req, res) => {
    try {
      // Validate request data
      try {
        resetPasswordSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationError.issues
          });
        }
      }
      
      const { token, password } = req.body;
      
      // Verify the token from JWT
      const decodedToken = verifyPasswordResetToken(token);
      if (!decodedToken) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Get token from database to ensure it's not already used
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is expired
      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Get the user
      const user = await storage.getUser(decodedToken.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update user password and clear any lockout from the attempts that prompted the reset
      const hashedPassword = await hashPassword(password);
      await storage.updateUser(user.id, { password: hashedPassword, failedLoginAttempts: 0, lastFailedLogin: null, accountLocked: false, accountLockedUntil: null });

  // Invalidate token after successful reset
  await storage.deletePasswordResetToken(token);
      // A reset usually means the old password may be known to someone else: end every session.
      await destroyUserSessions(user.id);
      
      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error in reset password flow:", error);
      res.status(500).json({ message: "An error occurred processing your request" });
    }
  });
  
  // Change password endpoint - for authenticated users to update their password
  app.post("/api/change-password", isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      
      // Get current user
  if (!req.user) throw new Error("User not authenticated");
  const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Update with new password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, {
        password: hashedPassword,
        updatedAt: new Date()
      });
      // Sign out every other session; the current one stays signed in.
      await destroyUserSessions(user.id, req.sessionID);

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  
  // Add session ping endpoint
  app.post("/api/session-ping", isAuthenticated, (req, res) => {
    // This endpoint just checks if user is authenticated
    // The session is automatically refreshed when accessed
    res.json({ 
      message: "Session refreshed",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
    });
  });

  // Email verification endpoint
  app.get("/api/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).send(`
          <html>
            <head><title>Email Verification Failed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #d32f2f;">Verification Failed</h1>
              <p>Invalid or missing verification token.</p>
              <a href="/auth" style="color: #FF8000;">Go to Login</a>
            </body>
          </html>
        `);
      }

      // Verify the token
      const decoded = verifyEmailVerificationToken(token);
      if (!decoded) {
        return res.status(400).send(`
          <html>
            <head><title>Email Verification Failed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #d32f2f;">Verification Failed</h1>
              <p>The verification link is invalid or has expired.</p>
              <a href="/auth" style="color: #FF8000;">Go to Login</a>
            </body>
          </html>
        `);
      }

      // Get the user
      const user = await storage.getUserByEmail(decoded.email);
      if (!user) {
        return res.status(404).send(`
          <html>
            <head><title>User Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #d32f2f;">User Not Found</h1>
              <p>No account found with this email address.</p>
              <a href="/auth" style="color: #FF8000;">Go to Login</a>
            </body>
          </html>
        `);
      }

      // Check if already verified
      if ((user as any).emailVerified) {
        return res.status(200).send(`
          <html>
            <head><title>Email Already Verified</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #4caf50;">Already Verified!</h1>
              <p>Your email address has already been verified.</p>
              <a href="/auth" style="color: #FF8000;">Go to Login</a>
            </body>
          </html>
        `);
      }

      // Update user as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        updatedAt: new Date()
      } as any);

      console.log('Email verified for user:', user.email);

      // Send success response
      res.status(200).send(`
        <html>
          <head><title>Email Verified</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #4caf50;">Email Verified Successfully!</h1>
            <p>Your email address has been verified. You can now log in to your account.</p>
            <div style="margin-top: 30px;">
              <a href="/auth" style="background-color: #FF8000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Go to Login
              </a>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).send(`
        <html>
          <head><title>Verification Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #d32f2f;">Verification Error</h1>
            <p>An error occurred during verification. Please try again later.</p>
            <a href="/auth" style="color: #FF8000;">Go to Login</a>
          </body>
        </html>
      `);
    }
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function hasOrganization(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.organizationId) {
    return res.status(403).json({ message: "Organization required" });
  }
  next();
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function isOrgAdminRequest(req: Request): Promise<boolean> {
  if (!req.user || !req.user.organizationId) return false;
  // Global admins are not treated as org admins here; they already have broader access
  if (req.user.isAdmin) return false;

  const rows = await db.select({ roleName: rolesSchema.name })
    .from(userRolesSchema)
    .innerJoin(rolesSchema, eq(userRolesSchema.roleId, rolesSchema.id))
    .where(eq(userRolesSchema.userId, req.user.id));

  return rows.some((r) => r.roleName === "OrgAdmin");
}

export async function isAdminOrOrgAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.isAdmin) return next();
    const orgAdmin = await isOrgAdminRequest(req);
    if (!orgAdmin) {
      return res.status(403).json({ message: "Admin or OrgAdmin access required" });
    }
    return next();
  } catch (error) {
    console.error("Role check failed:", error);
    return res.status(500).json({ message: "Authorization check failed" });
  }
}

export function isEmployee(req: Request, res: Response, next: NextFunction) {
  if (req.user && appRole(req.user) !== 'User') {
    return res.status(403).json({ message: "This endpoint is for employees only" });
  }
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function refreshSession(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    req.session.touch();
    console.log("Session refreshed for user:", req.user?.email);
  }
  next();
}
