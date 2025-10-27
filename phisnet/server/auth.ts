import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import express from "express"; // Add this missing import to fix the error
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, userValidationSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import { sql } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { generatePasswordResetToken, verifyPasswordResetToken, sendPasswordResetEmail } from "./email";

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

// Configure multer storage for profile pictures
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed!"));
  }
});

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
    .replace(/'/g, "''")
    .replace(/;/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .trim();
}

export function setupAuth(app: Express) {
  // Configure session with DATABASE-ONLY storage
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'phishnet-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore, // This will be the database session store
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 60 * 1000, // 30 minutes to match TTL
      httpOnly: true,
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure static routes for uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          console.log('Attempting login for:', email);
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            console.log('User not found:', email);
            return done(null, false, { message: "Invalid email or password" });
          }

          // Check if account is locked
          const lockStatus = await checkAccountLockStatus(user);
          if (lockStatus.locked) {
            return done(null, false, { message: lockStatus.message ?? "Account locked." });
          }

          const isValid = await comparePasswords(password, user.password);
          console.log('Password validation result:', isValid);

          if (!isValid) {
            const newAttemptCount = (user.failedLoginAttempts || 0) + 1;
            console.log(`Failed login attempt ${newAttemptCount} for user:`, email);
            
            const isLocked = await recordFailedLoginAttempt(user);
            if (isLocked) {
              return done(null, false, { 
                message: "Too many failed attempts. Account locked for 30 minutes." 
              });
            }
            return done(null, false, { 
              message: `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttemptCount} attempts remaining.` 
            });
          }

          await resetFailedLoginAttempts(user.id);
          return done(null, user);
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
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      try {
        userValidationSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationError.errors
          });
        }
      }

      const sanitizedEmail = sanitizeInput(req.body.email);
      let sanitizedOrgName = "";
      let orgId = 0;
      
      if (req.body.organizationName && req.body.organizationName.trim() !== '') {
        sanitizedOrgName = sanitizeInput(req.body.organizationName);
      } else {
        sanitizedOrgName = "None";
      }

      const existingUser = await storage.getUserByEmail(sanitizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      if (sanitizedOrgName === "None") {
        let noneOrg = await storage.getOrganizationByName("None");
        
        if (!noneOrg) {
          noneOrg = await storage.createOrganization({ name: "None" });
        }
        
        orgId = noneOrg.id;
      } else if (sanitizedOrgName) {
        const organization = await storage.getOrganizationByName(sanitizedOrgName);
        
        if (!organization) {
          const newOrg = await storage.createOrganization({ name: sanitizedOrgName });
          orgId = newOrg.id;
        } else {
          orgId = organization.id;
        }
      }

      let isFirstUser = false;
      if (orgId > 0) {
        const existingUsers = await storage.listUsers(orgId);
        isFirstUser = existingUsers.length === 0;
      }
      
      const isAdmin = isFirstUser && sanitizedOrgName !== "None" && sanitizedOrgName.length > 0;
      
      const user = await storage.createUser({
        ...req.body,
        email: sanitizedEmail,
        organizationName: sanitizedOrgName || "None",
        password: await hashPassword(req.body.password),
        organizationId: orgId,
        isAdmin: isAdmin
      });

      const { password, ...userWithoutPassword } = user;

      res.status(201).json({ 
        ...userWithoutPassword,
        message: "User registered successfully. Please log in."
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Upload profile picture endpoint
  app.post("/api/user/profile-picture", isAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const filePath = `/uploads/${req.file.filename}`;
      
      // Update user profile with the new picture path
  if (!req.user) throw new Error("User not authenticated");
  await storage.updateUser(req.user.id, {
        profilePicture: filePath
      });

      res.status(200).json({ 
        message: "Profile picture updated",
        profilePicture: filePath
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      
      // Handle multer errors specifically
  if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: "File too large. Maximum size is 10MB." 
        });
      }
      
  if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ 
          message: "Too many files. Only one file allowed." 
        });
      }
      
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string' && (error as any).message.includes('Only image files')) {
        return res.status(400).json({ 
          message: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." 
        });
      }
      
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });
  
  // Update user profile endpoint
  app.put("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const allowedFields = ['firstName', 'lastName', 'position', 'bio'];
      const updates: Partial<SelectUser> = {};
      
      // Only include allowed fields to prevent mass assignment vulnerabilities
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
      (updates as any)[field] = sanitizeInput(req.body[field]);
        }
      }
      
      // Update the user profile
  if (!req.user) throw new Error("User not authenticated");
  const updatedUser = await storage.updateUser(req.user.id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return sanitized user data
      const { password, ...userWithoutPassword } = updatedUser;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });
  
  // Forgot password endpoint - initiates password reset flow
  app.post("/api/forgot-password", async (req, res) => {
    try {
      // Validate request data
      try {
        forgotPasswordSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationError.errors
          });
        }
      }
      
      // Sanitize email input
      const sanitizedEmail = sanitizeInput(req.body.email);
      
      // Find user by email
      const user = await storage.getUserByEmail(sanitizedEmail);
      
      // Always return success even if user not found (security best practice)
      if (!user) {
        return res.status(200).json({ 
          message: "If an account exists with this email, a password reset link has been sent." 
        });
      }
      
      // Generate JWT token
      const token = generatePasswordResetToken(user);
      
  // Store token in database with expiry
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await storage.createPasswordResetToken({ userId: user.id, token, expiresAt } as any);
      
      // Generate reset URL for the email
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
      
      // Send password reset email
      const emailSent = await sendPasswordResetEmail(user, resetUrl);
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send password reset email" });
      }
      
      res.status(200).json({ 
        message: "Password reset link has been sent to your email." 
      });
    } catch (error) {
      console.error("Error in forgot password flow:", error);
      res.status(500).json({ message: "An error occurred processing your request" });
    }
  });
  
  // Reset password endpoint - completes password reset with new password
  app.post("/api/reset-password", async (req, res) => {
    try {
      // Validate request data
      try {
        resetPasswordSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validationError.errors
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
      
      // Update user password
      const hashedPassword = await hashPassword(password);
      await storage.updateUser(user.id, { password: hashedPassword });
      
  // Invalidate token after successful reset
  await storage.deletePasswordResetToken(token);
      
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
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function hasOrganization(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.organizationId) {
    return res.status(403).json({ message: "Organization required" });
  }
  next();
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
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
