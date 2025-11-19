import { Strategy as SamlStrategy, Profile } from "passport-saml";
import { db } from "../db";
import { ssoConfig, users, organizations } from "../../shared/schema";
import { eq } from "drizzle-orm";
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
      throw new Error('SAML not configured or enabled for this organization');
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
        cert: decryptedCertificate,
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/saml/callback`,
        acceptedClockSkewMs: 5000,
      },
      async (profile: Profile | null | undefined, done: any) => {
        try {
          if (!profile) {
            return done(new Error('No profile returned from IdP'));
          }

          const email = profile.email || profile.nameID;
          
          if (!email) {
            return done(new Error('No email found in SAML profile'));
          }

          // Find existing user
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

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

          const [newUser] = await db
            .insert(users)
            .values({
              email,
              password: '', // SSO users don't have passwords
              firstName,
              lastName,
              organizationId: org.id,
              organizationName: org.name,
              isAdmin: false,
            } as any)
            .returning();

          return done(null, newUser);
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

    if (!config || config.provider !== 'saml') {
      throw new Error('SAML not configured for this organization');
    }

    const callbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/saml/callback`;
    const entityId = config.entityId || `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/saml/metadata`;

    // Generate SAML Service Provider metadata
    const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService index="1"
                             isDefault="true"
                             Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                             Location="${callbackUrl}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

    return metadata;
  }
}
