import type { Express } from 'express';
import { isAuthenticated } from '../auth';
import { storage } from '../storage';
import { insertSmtpProfileSchema } from '@shared/schema';
import { z } from 'zod';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerSmtpProfileRoutes(app: Express) {
  // List all SMTP profiles
  app.get("/api/smtp-profiles", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const profiles = await storage.listSmtpProfiles(req.user.organizationId);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching SMTP profiles:", error);
      res.status(500).json({ message: "Error fetching SMTP profiles" });
    }
  });

  // Create a new SMTP profile
  app.post("/api/smtp-profiles", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const validatedData = insertSmtpProfileSchema.parse(req.body);
      const profileData = {
        ...validatedData,
        organizationId: req.user.organizationId
      };
      const profile = await storage.createSmtpProfile(req.user.organizationId, profileData);
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating SMTP profile" });
    }
  });
}
