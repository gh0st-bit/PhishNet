import { ValidateInResponseTo } from '@node-saml/node-saml';
import { Strategy as SamlStrategy, Profile } from "@node-saml/passport-saml";
import { db,controlPool } from "../db";
import { ssoConfig, users, organizations, rolesSchema, userRolesSchema } from "../../shared/schema";
import { eq,sql } from "drizzle-orm";
import SecretsService from "./secrets.service";

export class SsoService {
  /**
   * Initialize SAML strategy for an organization
   */
  static async initializeSamlStrategy(organizationId: number) {
    const [config] = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.organizationId, organizationId))
      .limit(1);

    if (!config || !config.enabled || config.provider !== 'saml') {
      throw Object.assign(new Error('SAML not configured or enabled for this organization'), { status: 404 });
    }

    if (!config.entityId || !config.ssoUrl || !config.certificate) {
      throw new Error('Incomplete SAML configuration');
    }

    // Decrypt certificate before using
    const decryptedCertificate = await SecretsService.decrypt(organizationId, config.certificate);

    const strategy = new SamlStrategy(
      {
        entryPoint: config.ssoUrl,
        issuer: config.entityId,
        idpCert: decryptedCertificate,
        callbackUrl: `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/auth/saml/callback`,
        audience:config.entityId,
        wantAssertionsSigned:true,
        wantAuthnResponseSigned:true,
        validateInResponseTo:ValidateInResponseTo.always,
        requestIdExpirationPeriodMs:300000,
        cacheProvider:{
          async saveAsync(key,value){await controlPool.query("INSERT INTO saml_request_cache(id,value,expires_at) VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT DO NOTHING",[`${organizationId}:${key}`,value]);return {value,createdAt:Date.now()};},
          async getAsync(key){return (await controlPool.query('SELECT value FROM saml_request_cache WHERE id=$1 AND expires_at>now()',[`${organizationId}:${key}`])).rows[0]?.value||null;},
          async removeAsync(key){return (await controlPool.query('DELETE FROM saml_request_cache WHERE id=$1 RETURNING value',[`${organizationId}:${key}`])).rows[0]?.value||null;}
        },
        acceptedClockSkewMs: 5000,
      },
      async (profile: Profile | null | undefined, done: any) => {
        try {
          if (!profile) {
            return done(new Error('No profile returned from IdP'));
          }

          const email = (profile.email || profile.nameID)?.trim().toLowerCase();
          
          if (!email) {
            return done(new Error('No email found in SAML profile'));
          }

          // Find existing user
          const [existingUser] = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email})=${email}`)
            .limit(1);

          if (existingUser && existingUser.organizationId !== organizationId) return done(new Error('Organization mismatch'));
          if (existingUser && !existingUser.isActive)return done(new Error("Account is inactive"));
          if (existingUser) {
            // Update last login
            await db
              .update(users)
              .set({ lastLogin: new Date() })
              .where(eq(users.id, existingUser.id));

            return done(null, existingUser);
          }

          // Auto-provision user if not exists
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, organizationId))
            .limit(1);

          if (!org) {
            return done(new Error('Organization not found'));
          }

          const firstName = profile.givenName || profile.firstName || email.split('@')[0];
          const lastName = profile.surname || profile.lastName || '';

          const newUser=await db.transaction(async tx=>{
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`);
            const [existing]=await tx.select().from(users).where(sql`lower(${users.email})=${email}`).limit(1);
            if(existing){if(existing.organizationId!==organizationId||!existing.isActive)throw new Error('Account is unavailable');return existing;}
            const [created]=await tx.insert(users).values({email,password:'',firstName:String(firstName),lastName:String(lastName),organizationId:org.id,organizationName:org.name,isAdmin:false,isActive:true,emailVerified:true}).returning();
            const [role]=await tx.select().from(rolesSchema).where(eq(rolesSchema.name,'User')).limit(1);
            if(!role)throw new Error('Employee role is not configured');
            await tx.insert(userRolesSchema).values({userId:created.id,roleId:role.id});return created;
          });

          return done(null, newUser);
        } catch (error) {
          return done(error as Error);
        }
      },
      async (profile: Profile | null | undefined, done: any) => {
        // Logout verify callback - just pass through
        // In most cases, we just need to acknowledge the logout
        try {
          return done(null, profile);
        } catch (error) {
          return done(error as Error);
        }
      }
    );

    return strategy;
  }

  /**
   * Get SSO configuration for an organization
   */
  static async getOrgSsoConfig(organizationId: number) {
    const [config] = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.organizationId, organizationId))
      .limit(1);

    return config || null;
  }

  /**
   * Check if SSO is enabled for an organization
   */
  static async isSsoEnabled(organizationId: number): Promise<boolean> {
    const config = await this.getOrgSsoConfig(organizationId);
    return config?.enabled ?? false;
  }

  /**
   * Get SAML metadata for an organization
   */
  static async getSamlMetadata(organizationId: number) {
    const [config] = await db
      .select()
      .from(ssoConfig)
      .where(eq(ssoConfig.organizationId, organizationId))
      .limit(1);

    if (!config?.provider || config.provider !== 'saml') {
      throw Object.assign(new Error('SAML not configured for this organization'), { status: 404 });
    }

    const strategy=await this.initializeSamlStrategy(organizationId);
    const metadata=strategy.generateServiceProviderMetadata(null,null);

    return metadata;
  }
}
