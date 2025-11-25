import type { Express } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
import { storage } from '../storage';
import { insertGroupSchema, insertTargetSchema } from '@shared/schema';
import { z } from 'zod';
import multer from 'multer';
import Papa from 'papaparse';

const upload = multer();

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerGroupRoutes(app: Express) {
  // List all groups
  app.get("/api/groups", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const groups = await storage.listGroups(req.user.organizationId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Error fetching groups" });
    }
  });

  // Create a new group
  app.post("/api/groups", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const validatedData = insertGroupSchema.parse(req.body);
      // Add organizationId to the validated data
      const groupData = {
        ...validatedData,
        organizationId: req.user.organizationId
      };
      const group = await storage.createGroup(req.user.organizationId, groupData);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating group" });
    }
  });

  // Update a group
  app.put("/api/groups/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = Number.parseInt(req.params.id, 10);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertGroupSchema.parse(req.body);
      const updatedGroup = await storage.updateGroup(groupId, validatedData);
      res.json(updatedGroup);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating group" });
    }
  });

  // Delete a group
  app.delete("/api/groups/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = Number.parseInt(req.params.id, 10);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if group is used in any campaigns and block deletion if so
      try {
        const activeUsage = await storage.getGroupUsage?.(groupId);
        if (activeUsage && activeUsage.isInUse) {
          return res.status(400).json({
            error: "GROUP_IN_USE",
            message: "This group is used in one or more campaigns and cannot be deleted.",
            details: activeUsage,
          });
        }
      } catch (usageError) {
        console.warn("Group usage check failed, continuing with delete:", usageError);
      }

      await storage.deleteGroup(groupId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: "Error deleting group" });
    }
  });

  // Get targets for a specific group
  app.get("/api/groups/:id/targets", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = Number.parseInt(req.params.id, 10);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const targets = await storage.listTargets(groupId);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching targets:", error);
      res.status(500).json({ message: "Error fetching targets" });
    }
  });

  // Create a new target in a group
  app.post("/api/groups/:id/targets", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = Number.parseInt(req.params.id, 10);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertTargetSchema.parse(req.body);
      // Provide sensible defaults if names are missing
      const firstName = validatedData.firstName && validatedData.firstName.trim().length > 0 ? validatedData.firstName : 'Recipient';
      const lastName = validatedData.lastName && validatedData.lastName.trim().length > 0 ? validatedData.lastName : 'User';
      const targetData = {
        ...validatedData,
        firstName,
        lastName,
        organizationId: req.user.organizationId,
        groupId: groupId
      };
      const target = await storage.createTarget(req.user.organizationId, groupId, targetData);
      res.status(201).json(target);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating target" });
    }
  });

  // Import targets from CSV
  app.post("/api/groups/:id/import", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      assertUser(req.user);
      const groupId = Number.parseInt(req.params.id, 10);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Ensure user has access to this group
      if (group.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const csvString = req.file.buffer.toString();
      const results = Papa.parse(csvString, { header: true, skipEmptyLines: true });
      
      if (results.errors.length > 0) {
        return res.status(400).json({ message: "CSV parsing error", errors: results.errors });
      }
      
      const importedTargets = [];
      const errors = [];
      
      for (let index = 0; index < results.data.length; index++) {
        const row = results.data[index];
        try {
          // Normalize field names
          const normalizedRow: any = {};
          for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
            const lowercaseKey = key.toLowerCase();
            if (lowercaseKey === 'firstname' || lowercaseKey === 'first_name') {
              normalizedRow.firstName = value;
            } else if (lowercaseKey === 'lastname' || lowercaseKey === 'last_name') {
              normalizedRow.lastName = value;
            } else if (lowercaseKey === 'email') {
              normalizedRow.email = value;
            } else if (lowercaseKey === 'position' || lowercaseKey === 'title') {
              normalizedRow.position = value;
            }
          }
          
          // Validate the data
          const validatedData = insertTargetSchema.parse(normalizedRow);
          // Provide sensible defaults if names are missing
          const firstName = validatedData.firstName && validatedData.firstName.toString().trim().length > 0 ? validatedData.firstName : 'Recipient';
          const lastName = validatedData.lastName && validatedData.lastName.toString().trim().length > 0 ? validatedData.lastName : 'User';
          // Create the target with required properties
          const targetData = {
            ...validatedData,
            firstName,
            lastName,
            organizationId: req.user.organizationId,
            groupId: groupId
          };
          const target = await storage.createTarget(req.user.organizationId, groupId, targetData);
          importedTargets.push(target);
        } catch (error) {
          errors.push({
            row: index + 2, // +2 to account for 0-based index and header row
            error: error instanceof z.ZodError ? error.errors : "Unknown error"
          });
        }
      }
      
      res.status(200).json({
        imported: importedTargets.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error importing targets:", error);
      res.status(500).json({ message: "Error importing targets" });
    }
  });
}
