import {randomBytes,timingSafeEqual} from 'node:crypto';
import { Express, Request, Response } from "express";
import passport from "passport";
import { db } from "../db";
import { ssoConfig, users, insertSsoConfigSchema, rolesSchema, userRolesSchema } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, isAdmin } from "../auth";
import { SsoService } from "../services/sso.service";
import SecretsService from "../services/secrets.service";

export function registerSsoRoutes(app: Express) {
  /**
   * GET /api/auth/saml/:orgId
   * Initiate SAML login for an organization
   */
  app.get("/api/auth/saml/:orgId", async (req: Request, res: Response, next) => {
    try {
      const orgId = Number.parseInt(req.params.orgId, 10);
      
      if (Number.isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      const strategy = await SsoService.initializeSamlStrategy(orgId);
      
      // Use the strategy directly to authenticate (cast to any to avoid type issues)

      
      const nonce=randomBytes(24).toString('hex');
      res.cookie(`phishnet.saml.${orgId}`,nonce,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.NODE_ENV==='production'?'none':'lax',path:'/api/auth/saml/callback',maxAge:300000});
      req.query.RelayState=`${orgId}.${nonce}`;
      passport.authenticate(strategy, {
        session: false,

      })(req, res, next);
    } catch (error) {
      // An organization without SAML is a normal "not found", not a server failure.
      const status = Number((error as any)?.status) === 404 ? 404 : 500;
      if (status === 500) console.error('SAML initiation error:', error);
      res.status(status).json({ 
        message: status === 404 && error instanceof Error ? error.message : "Failed to initiate SAML login" 
      });
    }
  });

  /**
   * POST /api/auth/saml/callback
   * SAML assertion consumer endpoint
   */
  app.post("/api/auth/saml/callback", async (req: Request, res: Response) => {
    try {
      const state=typeof req.body.RelayState==='string'?/^(\d+)\.([0-9a-f]{48})$/.exec(req.body.RelayState):null;
      if(!state)return res.status(400).json({message:'Invalid SAML state'});
      const orgId=Number(state[1]);const cookieName=`phishnet.saml.${orgId}`;
      const cookie=(req.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(!cookie||cookie.length!==state[2].length||!timingSafeEqual(Buffer.from(cookie),Buffer.from(state[2])))return res.status(403).json({message:'SAML browser state mismatch'});
      res.clearCookie(cookieName,{path:'/api/auth/saml/callback'});

      const strategy = await SsoService.initializeSamlStrategy(orgId);


      passport.authenticate(strategy, (err: Error | null, user: Express.User | false) => {
        if (err) {
          console.error('SAML authentication error:', err);
          return res.redirect('/login?error=saml_failed');
        }

        if (!user) {
          return res.redirect('/login?error=saml_no_user');
        }

        if(!user.isActive)return res.redirect('/auth?error=inactive');
        // SAML proves the primary identity; privileged and tenant MFA policy still applies.
        void (async()=>{
          const {storage}=await import('../storage');
          const org=await storage.getOrganization(user.organizationId);
          const roles=await db.select({name:rolesSchema.name}).from(userRolesSchema).innerJoin(rolesSchema,eq(userRolesSchema.roleId,rolesSchema.id)).where(eq(userRolesSchema.userId,user.id));
          const needsMfa=user.twoFactorEnabled||org?.twoFactorRequired||(process.env.NODE_ENV==='production'&&(user.isAdmin||roles.some(role=>role.name==='OrgAdmin')));
          if(needsMfa){(req.session as any).pendingTwoFactorUserId=user.id;(req.session as any).pendingTwoFactorExpiresAt=Date.now()+300000;return req.session.save(()=>res.redirect(user.twoFactorEnabled?'/auth?mfa=verify':'/auth?mfa=setup'));}
          // Manually establish session
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Session creation error:', loginErr);
            return res.redirect('/login?error=session_failed');
          }

          // Redirect to dashboard
          req.session.save(()=>res.redirect('/'));
        });
        })().catch(()=>res.redirect('/auth?error=saml_failed'));
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
      // An organization without SAML is a normal "not found", not a server failure.
      const status = Number((error as any)?.status) === 404 ? 404 : 500;
      if (status === 500) console.error('SAML metadata error:', error);
      res.status(status).json({ 
        message: status === 404 && error instanceof Error ? error.message : "Failed to retrieve SAML metadata" 
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
