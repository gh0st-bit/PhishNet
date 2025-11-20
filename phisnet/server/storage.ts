// Removed unused imports
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { db, pool } from "./db"; // Add pool to this import
import { 
  campaigns, 
  campaignResults, 
  emailTemplates, 
  users, 
  organizations,
  targets,
  groups,
  smtpProfiles, // Add missing imports
  landingPages,
  passwordResetTokens,
  threatIntelligence,
  threatStatistics
} from "@shared/schema";
import { eq, and, count, sql, gte } from "drizzle-orm";

// Add missing type imports
import type { 
  User, 
  InsertUser, 
  Organization, 
  InsertOrganization,
  Group,
  InsertGroup,
  Target,
  InsertTarget,
  SmtpProfile,
  InsertSmtpProfile,
  EmailTemplate,
  InsertEmailTemplate,
  LandingPage,
  InsertLandingPage,
  Campaign,
  InsertCampaign,
  CampaignResult,
  InsertCampaignResult,
  PasswordResetToken,
  InsertPasswordResetToken,
  ThreatIntelligence,
  InsertThreatIntelligence,
  ThreatStatistics,
  InsertThreatStatistics
} from "@shared/schema";

// Create PostgreSQL session store
const PostgresSessionStore = ConnectPgSimple(session);

export interface IStorage {
  sessionStore: any;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  listUsers(organizationId: number): Promise<User[]>;
  
  // Organization methods
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, data: Partial<Organization>): Promise<Organization | undefined>;
  deleteOrganization(id: number): Promise<boolean>;
  listOrganizations(): Promise<Organization[]>;
  
  // Group methods
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(organizationId: number, group: InsertGroup): Promise<Group>;
  updateGroup(id: number, data: Partial<Group>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<boolean>;
  listGroups(organizationId: number): Promise<(Group & { targetCount: number })[]>;
  
  // Target methods
  getTarget(id: number): Promise<Target | undefined>;
  createTarget(organizationId: number, groupId: number, target: InsertTarget): Promise<Target>;
  updateTarget(id: number, data: Partial<Target>): Promise<Target | undefined>;
  deleteTarget(id: number): Promise<boolean>;
  listTargets(groupId: number): Promise<Target[]>;
  
  // SMTP Profile methods
  getSmtpProfile(id: number): Promise<SmtpProfile | undefined>;
  createSmtpProfile(organizationId: number, profile: InsertSmtpProfile): Promise<SmtpProfile>;
  updateSmtpProfile(id: number, data: Partial<SmtpProfile>): Promise<SmtpProfile | undefined>;
  deleteSmtpProfile(id: number): Promise<boolean>;
  listSmtpProfiles(organizationId: number): Promise<SmtpProfile[]>;
  
  // Email Template methods
  getEmailTemplate(id: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(organizationId: number, userId: number, template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number): Promise<boolean>;
  listEmailTemplates(organizationId: number): Promise<EmailTemplate[]>;
  
  // Landing Page methods
  getLandingPage(id: number): Promise<LandingPage | undefined>;
  createLandingPage(organizationId: number, userId: number, page: InsertLandingPage): Promise<LandingPage>;
  updateLandingPage(id: number, data: Partial<LandingPage>): Promise<LandingPage | undefined>;
  deleteLandingPage(id: number): Promise<boolean>;
  listLandingPages(organizationId: number): Promise<LandingPage[]>;
  
  // Campaign methods
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(organizationId: number, userId: number, campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<boolean>;
  listCampaigns(organizationId: number): Promise<Campaign[]>;
  
  // Campaign Result methods
  getCampaignResult(id: number): Promise<CampaignResult | undefined>;
  createCampaignResult(result: InsertCampaignResult): Promise<CampaignResult>;
  updateCampaignResult(id: number, data: Partial<CampaignResult>): Promise<CampaignResult | undefined>;
  deleteCampaignResult(id: number): Promise<boolean>;
  listCampaignResults(campaignId: number): Promise<CampaignResult[]>;
  // Update by composite key helper
  updateCampaignResultByCampaignAndTarget(campaignId: number, targetId: number, data: Partial<CampaignResult>): Promise<CampaignResult | undefined>;
  
  // Password Reset Token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  
  // Dashboard stats
  getDashboardStats(organizationId: number): Promise<any>;
  getPhishingMetrics(organizationId: number): Promise<any[]>;
  getAtRiskUsers(organizationId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // ALWAYS use database session store - no fallback to memory
    this.sessionStore = new PostgresSessionStore({ 
      pool, // This should now work with the imported pool
      tableName: 'session',
      createTableIfMissing: true,
      ttl: 30 * 60 // 30 minutes in seconds
    });
    
    console.log('Database session store initialized with 30 minute TTL');
  }

  /**
   * Stop session store cleanup interval to allow graceful shutdown
   */
  stopSessionStore() {
    try {
      if (this.sessionStore && typeof this.sessionStore.stopInterval === 'function') {
        this.sessionStore.stopInterval();
      }
    } catch {
      // ignore if not available
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    // Use raw SQL and select only widely available columns to avoid schema drift issues (e.g., missing is_active)
    const result = await pool.query(
      `SELECT id, email, password, first_name, last_name, is_admin, organization_id, organization_name,
              created_at, updated_at
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) return undefined;
    const r = result.rows[0];
    // Map to User shape with safe defaults for optional/newer fields
    return {
      id: r.id,
      email: r.email,
      password: r.password,
      firstName: r.first_name,
      lastName: r.last_name,
      profilePicture: null,
      position: null,
      bio: null,
      lastLogin: null,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      accountLocked: false,
      accountLockedUntil: null,
      isActive: true,
      isAdmin: r.is_admin ?? false,
      organizationId: r.organization_id,
      organizationName: r.organization_name ?? "None",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } as unknown as User;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    // Use raw SQL and select only widely available columns to avoid schema drift issues (e.g., missing is_active)
    const result = await pool.query(
      `SELECT id, email, password, first_name, last_name, is_admin, organization_id, organization_name,
              created_at, updated_at
         FROM users
        WHERE email = $1
        LIMIT 1`,
      [email]
    );
    if (result.rows.length === 0) return undefined;
    const r = result.rows[0];
    // Map to User shape with safe defaults for optional/newer fields
    return {
      id: r.id,
      email: r.email,
      password: r.password,
      firstName: r.first_name,
      lastName: r.last_name,
      profilePicture: null,
      position: null,
      bio: null,
      lastLogin: null,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      accountLocked: false,
      accountLockedUntil: null,
      isActive: true,
      isAdmin: r.is_admin ?? false,
      organizationId: r.organization_id,
      organizationName: r.organization_name ?? "None",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } as unknown as User;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
    return true;
  }
  
  async listUsers(organizationId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organizationId, organizationId));
  }
  
  // Organization methods
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }
  
  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.name, name));
    return org;
  }
  
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    
    // Initialize encryption key for new organization
    const SecretsService = (await import('./services/secrets.service')).default;
    await SecretsService.ensureOrgKey(newOrg.id);
    
    return newOrg;
  }
  
  async updateOrganization(id: number, data: Partial<Organization>): Promise<Organization | undefined> {
    const [updatedOrg] = await db.update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();
    return updatedOrg;
  }
  
  async deleteOrganization(id: number): Promise<boolean> {
    await db.delete(organizations).where(eq(organizations.id, id));
    return true;
  }
  
  async listOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }
  
  // Group methods
  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }
  
  async createGroup(organizationId: number, group: InsertGroup): Promise<Group> {
    const [newGroup] = await db.insert(groups).values({
      name: group.name,
      description: group.description,
      organizationId,
    }).returning();
    return newGroup;
  }
  
  async updateGroup(id: number, data: Partial<Group>): Promise<Group | undefined> {
    const [updatedGroup] = await db.update(groups)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, id))
      .returning();
    return updatedGroup;
  }
  
  async deleteGroup(id: number): Promise<boolean> {
    await db.delete(groups).where(eq(groups.id, id));
    return true;
  }
  
  async listGroups(organizationId: number): Promise<(Group & { targetCount: number })[]> {
    const groupList = await db.select().from(groups).where(eq(groups.organizationId, organizationId));
    
    const groupsWithCounts = await Promise.all(
      groupList.map(async (group) => {
        const targetCount = await db.select({ count: count() })
          .from(targets)
          .where(eq(targets.groupId, group.id));
        
        return {
          ...group,
          targetCount: targetCount[0]?.count || 0,
        };
      })
    );
    
    return groupsWithCounts;
  }
  
  // Target methods
  async getTarget(id: number): Promise<Target | undefined> {
    const [target] = await db.select().from(targets).where(eq(targets.id, id));
    return target;
  }
  
  async createTarget(organizationId: number, groupId: number, target: InsertTarget): Promise<Target> {
    const [newTarget] = await db.insert(targets).values({
      firstName: (target as any).firstName && (target as any).firstName.trim().length > 0 ? (target as any).firstName : 'Recipient',
      lastName: (target as any).lastName && (target as any).lastName.trim().length > 0 ? (target as any).lastName : 'User',
      email: target.email,
      position: target.position,
      groupId,
      organizationId,
    }).returning();
    return newTarget;
  }
  
  async updateTarget(id: number, data: Partial<Target>): Promise<Target | undefined> {
    const [updatedTarget] = await db.update(targets)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(targets.id, id))
      .returning();
    return updatedTarget;
  }
  
  async deleteTarget(id: number): Promise<boolean> {
    await db.delete(targets).where(eq(targets.id, id));
    return true;
  }
  
  async listTargets(groupId: number): Promise<Target[]> {
    return await db.select().from(targets).where(eq(targets.groupId, groupId));
  }
  
  // SMTP Profile methods
  async getSmtpProfile(id: number): Promise<SmtpProfile | undefined> {
    const [profile] = await db.select().from(smtpProfiles).where(eq(smtpProfiles.id, id));
    return profile;
  }
  
  async createSmtpProfile(organizationId: number, profile: InsertSmtpProfile): Promise<SmtpProfile> {
    // Encrypt password before storing
    const SecretsService = (await import('./services/secrets.service')).default;
    const encryptedPassword = await SecretsService.encrypt(organizationId, profile.password);
    
    const [newProfile] = await db.insert(smtpProfiles).values({
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      password: encryptedPassword,
      fromEmail: profile.fromEmail,
      fromName: profile.fromName,
      organizationId,
    }).returning();
    return newProfile;
  }
  
  async updateSmtpProfile(id: number, data: Partial<SmtpProfile>): Promise<SmtpProfile | undefined> {
    // Encrypt password if being updated
    const SecretsService = (await import('./services/secrets.service')).default;
    const updateData = { ...data };
    
    if (updateData.password) {
      // Get profile to find organizationId
      const [existingProfile] = await db.select().from(smtpProfiles).where(eq(smtpProfiles.id, id));
      if (existingProfile) {
        updateData.password = await SecretsService.encrypt(existingProfile.organizationId, updateData.password);
      }
    }
    
    const [updatedProfile] = await db.update(smtpProfiles)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(smtpProfiles.id, id))
      .returning();
    return updatedProfile;
  }
  
  async deleteSmtpProfile(id: number): Promise<boolean> {
    await db.delete(smtpProfiles).where(eq(smtpProfiles.id, id));
    return true;
  }
  
  async listSmtpProfiles(organizationId: number): Promise<SmtpProfile[]> {
    const profiles = await db.select().from(smtpProfiles).where(eq(smtpProfiles.organizationId, organizationId));
    
    // Decrypt passwords before returning
    const SecretsService = (await import('./services/secrets.service')).default;
    return Promise.all(profiles.map(async (profile) => ({
      ...profile,
      password: await SecretsService.decrypt(organizationId, profile.password),
    })));
  }
  
  // Email Template methods
  async getEmailTemplate(id: number): Promise<EmailTemplate | undefined> {
    try {
      console.log(`Getting email template with ID: ${id}`);
      
      // Use direct database query to ensure we get the correct data
      const result = await pool.query(
        'SELECT * FROM email_templates WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        console.log(`No email template found with ID: ${id}`);
        return undefined;
      }
      
      const dbTemplate = result.rows[0];
      console.log(`Raw email template data from DB:`, dbTemplate);
      
      // Map database fields to Drizzle model (snake_case keys)
      const template = {
        id: dbTemplate.id,
        name: dbTemplate.name,
        subject: dbTemplate.subject,
        html_content: dbTemplate.html_content,
        text_content: dbTemplate.text_content,
        sender_name: dbTemplate.sender_name,
        sender_email: dbTemplate.sender_email,
        type: dbTemplate.type,
        complexity: dbTemplate.complexity,
        description: dbTemplate.description,
        category: dbTemplate.category,
        organization_id: dbTemplate.organization_id,
        created_by_id: dbTemplate.created_by_id,
        created_at: dbTemplate.created_at,
        updated_at: dbTemplate.updated_at,
      } as EmailTemplate;
      
      console.log(`Mapped email template data:`, template);
      return template;
    } catch (error) {
      console.error("Error getting email template:", error);
      throw error;
    }
  }
  
  async createEmailTemplate(organizationId: number, userId: number, template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [newTemplate] = await db.insert(emailTemplates).values({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      text_content: template.text_content,
      sender_name: template.sender_name,
      sender_email: template.sender_email,
      type: template.type,
      complexity: template.complexity,
      description: template.description,
      category: template.category,
      organization_id: organizationId,
      created_by_id: userId,
    }).returning();
    return newTemplate;
  }
  
  async updateEmailTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate | undefined> {
    const [updatedTemplate] = await db.update(emailTemplates)
      .set({
  ...data,
  updated_at: new Date(),
      })
      .where(eq(emailTemplates.id, id))
      .returning();
    return updatedTemplate;
  }
  
  async deleteEmailTemplate(id: number): Promise<boolean> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
    return true;
  }
  
  async listEmailTemplates(organizationId: number): Promise<EmailTemplate[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM email_templates WHERE organization_id = $1`,
        [organizationId]
      );
      
      // Map database rows to application model
      return result.rows.map(dbTemplate => ({
        id: dbTemplate.id,
        name: dbTemplate.name,
        subject: dbTemplate.subject,
        html_content: dbTemplate.html_content || dbTemplate.html || '',
        text_content: dbTemplate.text_content || dbTemplate.text || null,
        sender_name: dbTemplate.sender_name || '',
        sender_email: dbTemplate.sender_email || dbTemplate.envelope_sender || '',
        organization_id: dbTemplate.organization_id,
        created_at: dbTemplate.created_at,
        updated_at: dbTemplate.updated_at,
        created_by_id: dbTemplate.created_by_id,
        type: dbTemplate.type || null,
        complexity: dbTemplate.complexity || null,
        description: dbTemplate.description || null,
        category: dbTemplate.category || null
      }));
    } catch (error) {
      console.error("Error fetching email templates:", error);
      throw error;
    }
  }
  
  // Landing Page methods
  async getLandingPage(id: number): Promise<LandingPage | undefined> {
    const [page] = await db.select().from(landingPages).where(eq(landingPages.id, id));
    return page;
  }
  
  async createLandingPage(organizationId: number, userId: number, page: InsertLandingPage): Promise<LandingPage> {
    const [newPage] = await db.insert(landingPages).values({
      name: page.name,
      description: page.description,
      htmlContent: page.htmlContent,
      redirectUrl: page.redirectUrl,
      pageType: page.pageType,
      thumbnail: page.thumbnail,
  captureData: (page as any).captureData ?? true,
  capturePasswords: (page as any).capturePasswords ?? false,
      organizationId,
      createdById: userId,
    }).returning();
    return newPage;
  }
  
  async updateLandingPage(id: number, data: Partial<LandingPage>): Promise<LandingPage | undefined> {
    const [updatedPage] = await db.update(landingPages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(landingPages.id, id))
      .returning();
    return updatedPage;
  }
  
  async deleteLandingPage(id: number): Promise<boolean> {
    await db.delete(landingPages).where(eq(landingPages.id, id));
    return true;
  }
  
  async listLandingPages(organizationId: number): Promise<LandingPage[]> {
    // Order by pageType (acts as category) then name for stable grouping
    return await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.organizationId, organizationId))
      .orderBy(landingPages.pageType, landingPages.name);
  }
  
  // Campaign methods
  async getCampaign(id: number): Promise<Campaign | undefined> {
    try {
      console.log(`Getting campaign with ID: ${id}`);
      
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
      
      if (!campaign) {
        console.log(`No campaign found with ID: ${id}`);
        return undefined;
      }
      
      console.log(`Campaign found:`, campaign);
      return campaign;
    } catch (error) {
      console.error("Error getting campaign:", error);
      throw error;
    }
  }
  
  async createCampaign(organizationId: number, userId: number, campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values({
      name: campaign.name,
      targetGroupId: campaign.targetGroupId,
      smtpProfileId: campaign.smtpProfileId,
      emailTemplateId: campaign.emailTemplateId,
      landingPageId: campaign.landingPageId,
      scheduledAt: campaign.scheduledAt,
      endDate: campaign.endDate,
  status: campaign.scheduledAt ? "Scheduled" : "Draft",
      organizationId,
      createdById: userId,
    }).returning();
    return newCampaign;
  }
  
  async updateCampaign(id: number, data: Partial<Campaign>): Promise<Campaign | undefined> {
    const [updatedCampaign] = await db.update(campaigns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }
  
  async deleteCampaign(id: number): Promise<boolean> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
    return true;
  }
  
  async listCampaigns(organizationId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.organizationId, organizationId));
  }
  
  // Campaign Result methods
  async getCampaignResult(id: number): Promise<CampaignResult | undefined> {
    const [result] = await db.select().from(campaignResults).where(eq(campaignResults.id, id));
    return result;
  }
  
  async createCampaignResult(result: InsertCampaignResult): Promise<CampaignResult> {
    const [newResult] = await db.insert(campaignResults).values({
      ...result,
      // Ensure organizationId is present for integrity
      organizationId: (result as any).organizationId ?? undefined,
    }).returning();
    return newResult;
  }
  
  async updateCampaignResult(id: number, data: Partial<CampaignResult>): Promise<CampaignResult | undefined> {
    const [updatedResult] = await db.update(campaignResults)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(campaignResults.id, id))
      .returning();
    return updatedResult;
  }
  
  async updateCampaignResultByCampaignAndTarget(campaignId: number, targetId: number, data: Partial<CampaignResult>): Promise<CampaignResult | undefined> {
    const [updated] = await db.update(campaignResults)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignResults.campaignId, campaignId), eq(campaignResults.targetId, targetId)))
      .returning();
    return updated;
  }

  async deleteCampaignResult(id: number): Promise<boolean> {
    await db.delete(campaignResults).where(eq(campaignResults.id, id));
    return true;
  }
  
  async listCampaignResults(campaignId: number): Promise<CampaignResult[]> {
    return await db.select().from(campaignResults).where(eq(campaignResults.campaignId, campaignId));
  }
  
  // Password Reset Token methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
  console.log('[PasswordReset] createPasswordResetToken input:', token);
  // Ensure all fields are present
  const record = {
      token: (token as any).token,
      userId: (token as any).userId,
      expiresAt: (token as any).expiresAt,
      createdAt: new Date(),
    } as InsertPasswordResetToken;
  console.log('[PasswordReset] normalized record for insert:', record);
    const [newToken] = await db.insert(passwordResetTokens).values(record).returning();
    return newToken;
  }
  
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken;
  }
  
  async deletePasswordResetToken(token: string): Promise<boolean> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return true;
  }
  
  // Dashboard stats
  async getDashboardStats(organizationId: number): Promise<any> {
    try {
      // Get campaign stats
      const campaignStats = await db.select({
        status: campaigns.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId))
      .groupBy(campaigns.status);
      
      // Get total users in organization
      const totalUsers = await db.select({ count: sql<number>`count(*)`.as('count') })
        .from(users)
        .where(eq(users.organizationId, organizationId));
      
      // Get total groups
      const totalGroups = await db.select({ count: sql<number>`count(*)`.as('count') })
        .from(groups)
        .where(eq(groups.organizationId, organizationId));
      
      // Get campaign results for success rate - fix the variable name issue
      const results = await db.select({
        status: campaignResults.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(campaignResults)
      .innerJoin(campaigns, eq(campaignResults.campaignId, campaigns.id))
      .where(eq(campaigns.organizationId, organizationId))
      .groupBy(campaignResults.status);
      
      // Calculate metrics
      const activeCampaigns = campaignStats.find(s => s.status === 'Active')?.count || 0;
      const totalCampaigns = campaignStats.reduce((sum, s) => sum + s.count, 0);
      
      const totalClicks = results.find(r => r.status === 'clicked')?.count || 0;
      const totalSent = results.reduce((sum, r) => sum + r.count, 0);
      const successRate = totalSent > 0 ? Math.round((totalClicks / totalSent) * 100) : 0;
      
      // Get recent campaign changes (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentCampaigns = await db.select({ count: sql<number>`count(*)`.as('count') })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.organizationId, organizationId),
            gte(campaigns.createdAt, thirtyDaysAgo)
          )
        );
      
      return {
        activeCampaigns,
        totalCampaigns,
        successRate,
        totalUsers: totalUsers[0]?.count || 0,
        totalGroups: totalGroups[0]?.count || 0,
        campaignChange: recentCampaigns[0]?.count || 0,
        successRateChange: 0,
        newUsers: 0,
        trainingCompletion: 75,
        trainingCompletionChange: 5,
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw error;
    }
  }

  async getPhishingMetrics(organizationId: number): Promise<any[]> {
    try {
      // Get last 6 months of data
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const metrics = await db.select({
        month: sql<string>`DATE_TRUNC('month', ${campaigns.createdAt})`.as('month'),
        sent: sql<number>`count(CASE WHEN ${campaignResults.status} = 'sent' THEN 1 END)`.as('sent'),
        opened: sql<number>`count(CASE WHEN ${campaignResults.status} = 'opened' THEN 1 END)`.as('opened'),
        clicked: sql<number>`count(CASE WHEN ${campaignResults.status} = 'clicked' THEN 1 END)`.as('clicked'),
        submitted: sql<number>`count(CASE WHEN ${campaignResults.status} = 'submitted' THEN 1 END)`.as('submitted'),
      })
      .from(campaigns)
      .leftJoin(campaignResults, eq(campaigns.id, campaignResults.campaignId))
      .where(
        and(
          eq(campaigns.organizationId, organizationId),
          gte(campaigns.createdAt, sixMonthsAgo)
        )
      )
      .groupBy(sql`DATE_TRUNC('month', ${campaigns.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${campaigns.createdAt})`);
      
      return metrics.map(m => ({
        date: new Date(m.month).toLocaleDateString('en-US', { month: 'short' }),
        sent: m.sent,
        opened: m.opened,
        clicked: m.clicked,
        submitted: m.submitted,
        rate: m.sent > 0 ? Math.round((m.clicked / m.sent) * 100) : 0,
      }));
    } catch (error) {
      console.error("Error getting phishing metrics:", error);
      return [];
    }
  }

  async getAtRiskUsers(organizationId: number): Promise<any[]> {
    try {
      // Get users who clicked or submitted in recent campaigns
      const riskUsers = await db.select({
        targetId: targets.id,
        firstName: targets.firstName,
        lastName: targets.lastName,
        email: targets.email,
        department: targets.department,
        riskScore: sql<number>`count(CASE WHEN ${campaignResults.status} IN ('clicked', 'submitted') THEN 1 END)`.as('riskScore'),
      })
      .from(targets)
      .innerJoin(groups, eq(targets.groupId, groups.id))
      .leftJoin(campaignResults, eq(targets.id, campaignResults.targetId))
      .where(eq(groups.organizationId, organizationId))
      .groupBy(targets.id, targets.firstName, targets.lastName, targets.email, targets.department)
      .having(sql`count(CASE WHEN ${campaignResults.status} IN ('clicked', 'submitted') THEN 1 END) > 0`)
      .orderBy(sql`count(CASE WHEN ${campaignResults.status} IN ('clicked', 'submitted') THEN 1 END) DESC`)
      .limit(10);
      
      return riskUsers.map(user => {
        let riskLevel: 'High Risk' | 'Medium Risk' | 'Low Risk' = 'Low Risk';
        if (user.riskScore >= 3) riskLevel = 'High Risk';
        else if (user.riskScore >= 2) riskLevel = 'Medium Risk';
        return {
          id: user.targetId,
          name: `${user.firstName} ${user.lastName}`,
          department: user.department || 'Unknown',
          riskLevel,
          riskScore: user.riskScore,
        };
      });
    } catch (error) {
      console.error("Error getting at-risk users:", error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();


