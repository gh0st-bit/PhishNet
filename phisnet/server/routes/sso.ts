import { Express, Request, Response } from "express";
import passport from "passport";
import { db } from "../db";
import { ssoConfig, users, insertSsoConfigSchema } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, isAdmin } from "../auth";
import { SsoService } from "../services/sso.service";
import SecretsService from "../services/secrets.service";

export function registerSsoRoutes(app: Express) {
  /**
   * GET /api/auth/saml/:orgId
   * Initiate SAML login for an organization
   */
  app.get("/api/auth/saml/:orgId", async (req: Request, res: Response) => {
    try {
      const orgId = Number.parseInt(req.params.orgId, 10);
      
      if (Number.isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      const strategy = await SsoService.initializeSamlStrategy(orgId);
      
      // Use the strategy directly to authenticate (cast to any to avoid type issues)
      passport.use('saml', strategy as any);
      
      passport.authenticate('saml', {
        session: false,
      })(req, res);
    } catch (error) {
      console.error('SAML initiation error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to initiate SAML login" 
      });
    }
  });

  /**
   * POST /api/auth/saml/callback
   * SAML assertion consumer endpoint
   */
  app.post("/api/auth/saml/callback", async (req: Request, res: Response) => {
    try {
      // Extract org ID from RelayState or session
      const orgId = Number.parseInt(req.body.RelayState || req.query.orgId as string, 10);
      
      if (Number.isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization context" });
      }

      const strategy = await SsoService.initializeSamlStrategy(orgId);
      passport.use('saml', strategy as any);

      passport.authenticate('saml', (err: Error | null, user: Express.User | false) => {
        if (err) {
          console.error('SAML authentication error:', err);
          return res.redirect('/login?error=saml_failed');
        }

        if (!user) {
          return res.redirect('/login?error=saml_no_user');
        }

        // Manually establish session
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Session creation error:', loginErr);
            return res.redirect('/login?error=session_failed');
          }

          // Redirect to dashboard
          res.redirect('/');
        });
      })(req, res);
    } catch (error) {
      console.error('SAML callback error:', error);
      res.redirect('/login?error=saml_callback_failed');
    }
  });

  /**
   * GET /api/auth/saml/metadata/:orgId
   * Get SAML Service Provider metadata
   */
  app.get("/api/auth/saml/metadata/:orgId", async (req: Request, res: Response) => {
    try {
      const orgId = Number.parseInt(req.params.orgId, 10);
      
      if (Number.isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      const metadata = await SsoService.getSamlMetadata(orgId);
      
      res.set('Content-Type', 'application/xml');
      res.send(metadata);
    } catch (error) {
      console.error('SAML metadata error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to retrieve SAML metadata" 
      });
    }
  });

  /**
   * GET /api/sso/config
   * Get SSO configuration for authenticated user's organization
   */
  app.get("/api/sso/config", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      const config = await SsoService.getOrgSsoConfig(orgId);
      
      if (!config) {
        return res.json({ 
          enabled: false,
          provider: null,
        });
      }

      // Don't expose sensitive fields
      const { clientSecret, certificate, ...safeConfig } = config;
      
      res.json(safeConfig);
    } catch (error) {
      console.error('Get SSO config error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to retrieve SSO configuration" 
      });
    }
  });

  /**
   * PUT /api/sso/config
   * Update SSO configuration (admin only)
   */
  app.put("/api/sso/config", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      const validated = insertSsoConfigSchema.parse({
        ...req.body,
        organizationId: orgId,
      });

      // Encrypt sensitive fields before storing
      const dataToStore = { ...validated };
      if (dataToStore.clientSecret) {
        dataToStore.clientSecret = await SecretsService.encrypt(orgId, dataToStore.clientSecret);
      }
      if (dataToStore.certificate) {
        dataToStore.certificate = await SecretsService.encrypt(orgId, dataToStore.certificate);
      }

      // Check if config exists
      const [existing] = await db
        .select()
        .from(ssoConfig)
        .where(eq(ssoConfig.organizationId, orgId))
        .limit(1);

      let result;
      if (existing) {
        [result] = await db
          .update(ssoConfig)
          .set({
            ...dataToStore,
            updatedAt: new Date(),
          })
          .where(eq(ssoConfig.organizationId, orgId))
          .returning();
      } else {
        [result] = await db
          .insert(ssoConfig)
          .values(dataToStore)
          .returning();
      }

      const { clientSecret, certificate, ...safeResult } = result;
      
      res.json(safeResult);
    } catch (error) {
      console.error('Update SSO config error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update SSO configuration" 
      });
    }
  });

  /**
   * DELETE /api/sso/config
   * Delete SSO configuration (admin only)
   */
  app.delete("/api/sso/config", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      await db
        .delete(ssoConfig)
        .where(eq(ssoConfig.organizationId, orgId));

      res.json({ message: "SSO configuration deleted successfully" });
    } catch (error) {
      console.error('Delete SSO config error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete SSO configuration" 
      });
    }
  });

  /**
   * GET /api/sso/check/:email
   * Check if SSO is enabled for a user's email domain (public endpoint)
   */
  app.get("/api/sso/check/:email", async (req: Request, res: Response) => {
    try {
      const email = req.params.email;
      const domain = email.split('@')[1];

      if (!domain) {
        return res.json({ enabled: false });
      }

      // Find user by email to get organization
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.json({ enabled: false });
      }

      const enabled = await SsoService.isSsoEnabled((user as any).organizationId);
      
      res.json({ 
        enabled,
        organizationId: enabled ? (user as any).organizationId : undefined,
      });
    } catch (error) {
      console.error('Check SSO error:', error);
      res.json({ enabled: false });
    }
  });
}
