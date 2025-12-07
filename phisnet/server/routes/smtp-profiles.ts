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

  // Delete an SMTP profile
  app.delete("/api/smtp-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const profileId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(profileId)) {
        return res.status(400).json({ message: "Invalid SMTP profile id" });
      }

      const profile = await storage.getSmtpProfile(profileId);
      if (!profile) {
        return res.status(404).json({ message: "SMTP profile not found" });
      }

      if (profile.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      try {
        const success = await storage.deleteSmtpProfile(profileId);
        if (!success) {
          return res.status(500).json({ message: "Failed to delete SMTP profile" });
        }
      } catch (dbError: any) {
        if (dbError?.code === '23503') {
          return res.status(409).json({ message: "Cannot delete SMTP profile while campaigns are using it" });
        }
        throw dbError;
      }

      return res.status(200).json({ message: "SMTP profile deleted successfully" });
    } catch (error) {
      console.error("Error deleting SMTP profile:", error);
      res.status(500).json({ message: "Error deleting SMTP profile" });
    }
  });
}
