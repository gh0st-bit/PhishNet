import type { Express } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
import { storage } from '../storage';
import { insertEmailTemplateSchema } from '@shared/schema';
import { z } from 'zod';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerEmailTemplateRoutes(app: Express) {
  // List all email templates
  app.get("/api/email-templates", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      // Get templates directly from storage 
      const templates = await storage.listEmailTemplates(req.user.organizationId);
      
      // Return templates directly with snake_case field names as expected by frontend
      const mappedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        subject: template.subject,
        html_content: template.html_content || "",
        text_content: template.text_content || null,
        sender_name: template.sender_name || "PhishNet Team",
        sender_email: template.sender_email || "phishing@example.com",
        type: template.type || "phishing-business",
        complexity: template.complexity || "medium",
        description: template.description || null,
        category: template.category || null,
        organization_id: template.organization_id,
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by_id: template.created_by_id
      }));
      
      res.json(mappedTemplates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ message: "Error fetching email templates" });
    }
  });

  // Create a new email template
  app.post("/api/email-templates", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      console.log("Received template data:", req.body);
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      console.log("Validated template data:", validatedData);
      
      // Create a template using existing storage method
      const template = await storage.createEmailTemplate(
        req.user.organizationId, 
        req.user.id, 
        {
          name: validatedData.name,
          subject: validatedData.subject,
          // Fix the field mapping to match Drizzle schema (snake_case):
          html_content: validatedData.htmlContent || validatedData.html_content || "<div>Default content</div>",
          text_content: validatedData.textContent || validatedData.text_content || null,
          sender_name: validatedData.senderName || validatedData.sender_name || "PhishNet Team",
          sender_email: validatedData.senderEmail || validatedData.sender_email || "phishing@example.com",
          type: validatedData.type,
          complexity: validatedData.complexity,
          description: validatedData.description,
          category: validatedData.category,
          // Satisfy InsertEmailTemplate type
          organization_id: req.user.organizationId,
        }
      );
      console.log("Created template:", template);
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating email template" });
    }
  });

  // Update an email template
  app.put("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const templateId = Number.parseInt(req.params.id, 10);
      const template = await storage.getEmailTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Ensure user has access to this template
      if (template.organization_id !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      const updatedTemplate = await storage.updateEmailTemplate(templateId, validatedData);
      res.json(updatedTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating email template" });
    }
  });
  
  // Delete an email template
  app.delete("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const templateId = Number.parseInt(req.params.id, 10);
      const template = await storage.getEmailTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      
      // Ensure user has access to this template
      if (template.organization_id !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteEmailTemplate(templateId);
      if (success) {
        return res.status(200).json({ message: "Email template deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete email template" });
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Error deleting email template" });
    }
  });
}
