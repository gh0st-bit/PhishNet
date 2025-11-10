import type { Express } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
import { storage } from '../storage';
import { insertLandingPageSchema } from '@shared/schema';
import { z } from 'zod';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerLandingPageRoutes(app: Express) {
  // List all landing pages
  app.get("/api/landing-pages", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pages = await storage.listLandingPages(req.user.organizationId);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching landing pages:", error);
      res.status(500).json({ message: "Error fetching landing pages" });
    }
  });

  // Create a new landing page
  app.post("/api/landing-pages", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const validatedData = insertLandingPageSchema.parse(req.body);
      
      // Create the landing page with thumbnail
      const pageData = {
        ...validatedData,
        organizationId: req.user.organizationId
      };
      const page = await storage.createLandingPage(
        req.user.organizationId,
        req.user.id,
        pageData
      );
      
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating landing page" });
    }
  });

  // Update a landing page
  app.put("/api/landing-pages/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pageId = Number.parseInt(req.params.id, 10);
      const page = await storage.getLandingPage(pageId);
      
      if (!page) {
        return res.status(404).json({ message: "Landing page not found" });
      }
      
      // Ensure user has access to this page
      if (page.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const validatedData = insertLandingPageSchema.parse(req.body);
      
      // Update the landing page with the thumbnail
      const updatedPage = await storage.updateLandingPage(
        pageId,
        validatedData
      );
      
      res.json(updatedPage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating landing page" });
    }
  });
  
  // Delete a landing page
  app.delete("/api/landing-pages/:id", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pageId = Number.parseInt(req.params.id, 10);
      const page = await storage.getLandingPage(pageId);
      
      if (!page) {
        return res.status(404).json({ message: "Landing page not found" });
      }
      
      // Ensure user has access to this page
      if (page.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const success = await storage.deleteLandingPage(pageId);
      if (success) {
        return res.status(200).json({ message: "Landing page deleted successfully" });
      } else {
        return res.status(500).json({ message: "Failed to delete landing page" });
      }
    } catch (error) {
      console.error("Error deleting landing page:", error);
      res.status(500).json({ message: "Error deleting landing page" });
    }
  });

  // Landing Page preview (returns raw HTML)
  app.get("/api/landing-pages/:id/preview", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pageId = Number.parseInt(req.params.id, 10);
      const page = await storage.getLandingPage(pageId);
      if (!page) {
        return res.status(404).send("Not Found");
      }
      if (page.organizationId !== req.user.organizationId) {
        return res.status(403).send("Forbidden");
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(page.htmlContent || '<!doctype html><html><body><p>No content</p></body></html>');
    } catch (error) {
      console.error('Error rendering landing page preview:', error);
      return res.status(500).send('Preview error');
    }
  });

  // Clone a landing page from external URL
  app.post("/api/landing-pages/clone", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "Valid URL is required" });
      }
      
      try {
        // Use fetch to get the HTML content
        const response = await fetch(url, {
          headers: {
            // Add a user agent to avoid being blocked
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          return res.status(400).json({ 
            message: `Failed to fetch webpage: ${response.status} ${response.statusText}` 
          });
        }
        
        // Get HTML content as text
        const htmlContent = await response.text();
        // Try to extract <title>
        let title: string | undefined;
        try {
          const m = /<title>([^<]*)<\/title>/i.exec(htmlContent);
          title = m?.[1]?.trim();
        } catch {}
        // Return JSON used by the client editor
        return res.json({ 
          htmlContent,
          title: title || 'Cloned Website',
          message: "Website cloned successfully" 
        });
      } catch (error) {
        console.error("Error cloning website:", error);
        return res.status(400).json({ 
          message: `Error fetching URL: ${(error as Error)?.message || "Unknown error"}` 
        });
      }
    } catch (error) {
      console.error("Server error while cloning website:", error);
      return res.status(500).json({ message: "Error cloning webpage" });
    }
  });

  // Clone an existing landing page by ID
  app.post("/api/landing-pages/:id/clone", isAuthenticated, hasOrganization, async (req, res) => {
    try {
      assertUser(req.user);
      const pageId = Number.parseInt(req.params.id, 10);
      const page = await storage.getLandingPage(pageId);
      if (!page) {
        return res.status(404).json({ message: "Landing page not found" });
      }
      if (page.organizationId !== req.user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const cloned = await storage.createLandingPage(req.user.organizationId, req.user.id, {
        name: `${page.name} (Copy)`,
        description: page.description || null,
        htmlContent: page.htmlContent,
        redirectUrl: page.redirectUrl || null,
        pageType: page.pageType,
        thumbnail: page.thumbnail || null,
        captureData: (page as any).captureData ?? true,
        capturePasswords: (page as any).capturePasswords ?? false,
      } as any);
      return res.status(201).json(cloned);
    } catch (error) {
      console.error('Error cloning landing page by id:', error);
      return res.status(500).json({ message: 'Error cloning landing page' });
    }
  });
}
