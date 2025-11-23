import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations table (for multi-tenancy)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Data retention policy in days (per organization)
  dataRetentionDays: integer("data_retention_days").default(365).notNull(),
  // Per-organization encryption key for secrets management
  encryptionKey: text("encryption_key"),
  // Whether all users in this organization must have 2FA enabled
  twoFactorRequired: boolean("two_factor_required").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SSO Configuration table
export const ssoConfig = pgTable("sso_config", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  provider: text("provider").notNull(), // 'saml' or 'oidc'
  entityId: text("entity_id"), // SAML Entity ID
  ssoUrl: text("sso_url"), // SAML SSO URL or OIDC authorization endpoint
  certificate: text("certificate"), // SAML x509 certificate
  issuer: text("issuer"), // OIDC issuer
  clientId: text("client_id"), // OIDC client ID
  clientSecret: text("client_secret"), // OIDC client secret
  callbackUrl: text("callback_url"), // OIDC callback URL
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  profilePicture: text("profile_picture"),
  position: text("position"),
  bio: text("bio"),
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lastFailedLogin: timestamp("last_failed_login"),
  accountLocked: boolean("account_locked").default(false).notNull(),
  accountLockedUntil: timestamp("account_locked_until"),
  // Active status column (added via migration add_is_active_to_users.sql)
  isActive: boolean("is_active").default(true).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  organizationName: text("organization_name").notNull().default("None"),
  // Email verification fields
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  // Two-Factor Authentication fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  // Encrypted base32 secret (using SecretsService + org key)
  twoFactorSecret: text("two_factor_secret"),
  // Array of hashed backup codes (each one-time use). Stored as TEXT[] matching migration.
  twoFactorBackupCodes: text("two_factor_backup_codes").array().default([]),
  // Timestamp of last successful 2FA verification (login or setup)
  twoFactorVerifiedAt: timestamp("two_factor_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User enrollment/invitation tokens (KnowBe4-like flow)
export const userInvites = pgTable("user_invites", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  invitedByUserId: integer("invited_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Groups table (for targets/recipients)
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Targets table (email recipients)
export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  position: text("position"),
  department: text("department"),
  groupId: integer("group_id").references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SMTP Profiles table
export const smtpProfiles = pgTable("smtp_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Templates table
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  html_content: text("html_content").notNull(),
  text_content: text("text_content"),
  sender_name: text("sender_name").notNull(),
  sender_email: text("sender_email").notNull(),
  type: text("type"),
  complexity: text("complexity"),
  description: text("description"),
  category: text("category"),
  organization_id: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by_id: integer("created_by_id").references(() => users.id),
});

// Landing Pages table
export const landingPages = pgTable("landing_pages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  htmlContent: text("html_content").notNull(),
  redirectUrl: text("redirect_url"),
  pageType: text("page_type").default("basic"),
  thumbnail: text("thumbnail"),
  captureData: boolean("capture_data").default(true),
  capturePasswords: boolean("capture_passwords").default(false),
  // Microlearning fields
  enableMicrolearning: boolean("enable_microlearning").default(false),
  learningTitle: text("learning_title"),
  learningContent: text("learning_content"),
  learningTips: jsonb("learning_tips").default('[]'), // Array of tip strings
  remediationLinks: jsonb("remediation_links").default('[]'), // Array of {title, url} objects
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Draft"), // Draft, Scheduled, Active, Completed
  targetGroupId: integer("target_group_id").references(() => groups.id, { onDelete: 'restrict' }).notNull(),
  smtpProfileId: integer("smtp_profile_id").references(() => smtpProfiles.id, { onDelete: 'restrict' }).notNull(),
  emailTemplateId: integer("email_template_id").references(() => emailTemplates.id, { onDelete: 'restrict' }).notNull(),
  landingPageId: integer("landing_page_id").references(() => landingPages.id, { onDelete: 'restrict' }).notNull(),
  scheduledAt: timestamp("scheduled_at"),
  endDate: timestamp("end_date"),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Campaign Results table
export const campaignResults = pgTable("campaign_results", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  targetId: integer("target_id").references(() => targets.id, { onDelete: 'cascade' }).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, opened, clicked, submitted
  sent: boolean("sent").default(false),
  sentAt: timestamp("sent_at"),
  opened: boolean("opened").default(false),
  openedAt: timestamp("opened_at"),
  clicked: boolean("clicked").default(false),
  clickedAt: timestamp("clicked_at"),
  submitted: boolean("submitted").default(false),
  submittedAt: timestamp("submitted_at"),
  submittedData: jsonb("submitted_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notifications table
export const notificationsSchema = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  priority: varchar("priority", { length: 20 }).default('medium'),
  actionUrl: varchar("action_url", { length: 500 }),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const notificationPreferencesSchema = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  campaignAlerts: boolean("campaign_alerts").default(true),
  securityAlerts: boolean("security_alerts").default(true),
  systemUpdates: boolean("system_updates").default(true),
  weeklyReports: boolean("weekly_reports").default(true),
  // New granular invite notification toggles
  inviteDashboard: boolean("invite_dashboard").default(true),
  inviteEmail: boolean("invite_email").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Roles and Permissions
export const rolesSchema = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 200 }),
  permissions: jsonb("permissions").notNull().default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const userRolesSchema = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").references(() => rolesSchema.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow()
});

// Threat Intelligence table
export const threatIntelligence = pgTable("threat_intelligence", {
  id: serial("id").primaryKey(),
  
  // Core threat data
  url: text("url"),
  domain: varchar("domain", { length: 255 }),
  indicator: text("indicator"), // Changed from varchar(500) to text for unlimited length
  indicatorType: varchar("indicator_type", { length: 50 }), // 'url', 'domain', 'ip', 'hash'
  // Canonical normalized indicator for deduplication (lower-cased coalesce of indicator/url/domain)
  normalizedIndicator: text("normalized_indicator"),
  
  // Classification
  threatType: varchar("threat_type", { length: 100 }), // 'phishing', 'malware', 'spam', 'c2'
  malwareFamily: varchar("malware_family", { length: 100 }),
  campaignName: varchar("campaign_name", { length: 200 }),
  
  // Metadata
  source: varchar("source", { length: 100 }).notNull(), // 'urlhaus', 'openphish', etc.
  confidence: integer("confidence").default(0), // 0-100
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  firstSeen: timestamp("first_seen").notNull(),
  lastSeen: timestamp("last_seen"),
  expiresAt: timestamp("expires_at"),
  
  // Additional data
  tags: jsonb("tags").default('[]'),
  description: text("description"),
  rawData: jsonb("raw_data"),
  
  // PhishNet specific
  usedInSimulations: boolean("used_in_simulations").default(false),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Threat Statistics table for dashboard
export const threatStatistics = pgTable("threat_statistics", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  threatType: varchar("threat_type", { length: 100 }).notNull(),
  count: integer("count").default(0),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Report Schedules table (for automated PDF/email reports)
export const reportSchedules = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  // Report type: 'executive' | 'detailed' | 'compliance'
  type: varchar("type", { length: 20 }).notNull(),
  // Cadence: 'daily' | 'weekly' | 'monthly'
  cadence: varchar("cadence", { length: 20 }).notNull(),
  // Time of day in HH:mm (24h) format, local or specified timezone
  timeOfDay: varchar("time_of_day", { length: 5 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).default('UTC').notNull(),
  // Comma-separated list of recipient emails (MVP)
  recipients: text("recipients").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit Logs (admin & security auditing)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 200 }),
  resourceId: integer("resource_id"),
  ip: varchar("ip", { length: 64 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Risk Scores (per user, time‑series)
export const riskScores = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  score: integer("score").notNull(), // 0–100
  factors: jsonb("factors").default('[]'), // contributing factors
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
});

// SCIM objects (provisioning)
export const scimUsers = pgTable("scim_users", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  externalId: varchar("external_id", { length: 200 }).notNull(),
  active: boolean("active").default(true).notNull(),
  data: jsonb("data").default('{}'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scimGroups = pgTable("scim_groups", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  externalId: varchar("external_id", { length: 200 }).notNull(),
  data: jsonb("data").default('{}'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Define permission types
export const PERMISSIONS = {
  // Dashboard permissions
  DASHBOARD_VIEW: "dashboard:view",
  DASHBOARD_ANALYTICS: "dashboard:analytics",
  
  // Campaign permissions
  CAMPAIGNS_VIEW: "campaigns:view",
  CAMPAIGNS_CREATE: "campaigns:create",
  CAMPAIGNS_EDIT: "campaigns:edit",
  CAMPAIGNS_DELETE: "campaigns:delete",
  CAMPAIGNS_LAUNCH: "campaigns:launch",
  
  // Groups permissions
  GROUPS_VIEW: "groups:view",
  GROUPS_CREATE: "groups:create",
  GROUPS_EDIT: "groups:edit",
  GROUPS_DELETE: "groups:delete",
  
  // Template permissions
  TEMPLATES_VIEW: "templates:view",
  TEMPLATES_CREATE: "templates:create",
  TEMPLATES_EDIT: "templates:edit",
  TEMPLATES_DELETE: "templates:delete",
  
  // SMTP permissions
  SMTP_VIEW: "smtp:view",
  SMTP_CREATE: "smtp:create",
  SMTP_EDIT: "smtp:edit",
  SMTP_DELETE: "smtp:delete",
  
  // Reports permissions
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",
  REPORTS_ANALYTICS: "reports:analytics",
  
  // User management permissions
  USERS_VIEW: "users:view",
  USERS_CREATE: "users:create",
  USERS_EDIT: "users:edit",
  USERS_DELETE: "users:delete",
  USERS_MANAGE_ROLES: "users:manage_roles", // Add this missing permission
  
  // Organization permissions
  ORG_MANAGE: "organization:manage",
  ORG_SETTINGS: "organization:settings",
  
  // System permissions
  SYSTEM_ADMIN: "system:admin",
};

// Default role permissions
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_ANALYTICS,
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_EDIT,
    PERMISSIONS.CAMPAIGNS_DELETE,
    PERMISSIONS.CAMPAIGNS_LAUNCH,
    PERMISSIONS.GROUPS_VIEW,
    PERMISSIONS.GROUPS_CREATE,
    PERMISSIONS.GROUPS_EDIT,
    PERMISSIONS.GROUPS_DELETE,
    PERMISSIONS.TEMPLATES_VIEW,
    PERMISSIONS.TEMPLATES_CREATE,
    PERMISSIONS.TEMPLATES_EDIT,
    PERMISSIONS.TEMPLATES_DELETE,
    PERMISSIONS.SMTP_VIEW,
    PERMISSIONS.SMTP_CREATE,
    PERMISSIONS.SMTP_EDIT,
    PERMISSIONS.SMTP_DELETE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_ANALYTICS,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_SETTINGS,
  ],
  user: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.GROUPS_VIEW,
    PERMISSIONS.TEMPLATES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  viewer: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CAMPAIGNS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ]
};

// Export TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;
export type Target = typeof targets.$inferSelect;
export type InsertTarget = typeof targets.$inferInsert;
export type SmtpProfile = typeof smtpProfiles.$inferSelect;
export type InsertSmtpProfile = typeof smtpProfiles.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;
export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = typeof landingPages.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type CampaignResult = typeof campaignResults.$inferSelect;
export type InsertCampaignResult = typeof campaignResults.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type ThreatIntelligence = typeof threatIntelligence.$inferSelect;
export type InsertThreatIntelligence = typeof threatIntelligence.$inferInsert;
export type ThreatStatistics = typeof threatStatistics.$inferSelect;
export type InsertThreatStatistics = typeof threatStatistics.$inferInsert;
export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type RiskScore = typeof riskScores.$inferSelect;
export type InsertRiskScore = typeof riskScores.$inferInsert;
export type ScimUser = typeof scimUsers.$inferSelect;
export type InsertScimUser = typeof scimUsers.$inferInsert;
export type ScimGroup = typeof scimGroups.$inferSelect;
export type InsertScimGroup = typeof scimGroups.$inferInsert;
export type SsoConfig = typeof ssoConfig.$inferSelect;
export type InsertSsoConfig = typeof ssoConfig.$inferInsert;
export type UserInvite = typeof userInvites.$inferSelect;
export type InsertUserInvite = typeof userInvites.$inferInsert;
export type TrainingModule = typeof trainingModules.$inferSelect;
export type InsertTrainingModule = typeof trainingModules.$inferInsert;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = typeof badges.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;
export type FlashcardDeck = typeof flashcardDecks.$inferSelect;
export type InsertFlashcardDeck = typeof flashcardDecks.$inferInsert;
export type Flashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = typeof flashcards.$inferInsert;

// Validation schemas - ONLY DECLARE ONCE
export const userValidationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  position: z.string().optional(),
  bio: z.string().optional(),
  profilePicture: z.string().optional(),
  isAdmin: z.boolean().optional(),
  organizationName: z.string().optional(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  position: true,
  bio: true,
  profilePicture: true,
  isAdmin: true,
  organizationName: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  dataRetentionDays: true,
});

export const insertGroupSchema = createInsertSchema(groups).pick({
  name: true,
  description: true,
});

// Allow creating targets with just an email; first/last names will be defaulted in routes
export const insertTargetSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Please provide a valid email address"),
  position: z.string().optional(),
  department: z.string().optional(),
});

export const insertSmtpProfileSchema = createInsertSchema(smtpProfiles).pick({
  name: true,
  host: true,
  port: true,
  username: true,
  password: true,
  fromEmail: true,
  fromName: true,
});

export const insertEmailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "HTML content is required").optional(),
  html_content: z.string().min(1, "HTML content is required").optional(),
  textContent: z.string().optional(),
  text_content: z.string().optional(),
  senderName: z.string().min(1, "Sender name is required").optional(),
  sender_name: z.string().min(1, "Sender name is required").optional(),
  senderEmail: z.string().email("Invalid email format").min(1, "Sender email is required").optional(),
  sender_email: z.string().email("Invalid email format").min(1, "Sender email is required").optional(),
  type: z.string().optional(),
  complexity: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
}).refine(data => data.htmlContent || data.html_content, {
  message: "HTML content is required",
  path: ["htmlContent"]
}).refine(data => data.senderName || data.sender_name, {
  message: "Sender name is required",
  path: ["senderName"]
}).refine(data => data.senderEmail || data.sender_email, {
  message: "Sender email is required",
  path: ["senderEmail"]
});

// Report schedule validation
export const insertReportScheduleSchema = z.object({
  type: z.enum(["executive", "detailed", "compliance"]),
  cadence: z.enum(["daily", "weekly", "monthly"]),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/i, "timeOfDay must be HH:mm"),
  timezone: z.string().min(2).default("UTC"),
  recipients: z.string().min(3, "Provide at least one recipient email (comma-separated)"),
  enabled: z.boolean().optional(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  organizationId: true,
  userId: true,
  action: true,
  resource: true,
  resourceId: true,
  ip: true,
  userAgent: true,
  metadata: true,
});

export const insertSsoConfigSchema = createInsertSchema(ssoConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRiskScoreSchema = createInsertSchema(riskScores).pick({
  organizationId: true,
  userId: true,
  score: true,
  factors: true,
  calculatedAt: true,
});

export const insertScimUserSchema = createInsertSchema(scimUsers).pick({
  organizationId: true,
  externalId: true,
  active: true,
  data: true,
});

export const insertScimGroupSchema = createInsertSchema(scimGroups).pick({
  organizationId: true,
  externalId: true,
  data: true,
});

export const insertLandingPageSchema = createInsertSchema(landingPages).pick({
  name: true,
  description: true,
  htmlContent: true,
  redirectUrl: true,
  pageType: true,
  thumbnail: true,
  captureData: true,
  capturePasswords: true,
  enableMicrolearning: true,
  learningTitle: true,
  learningContent: true,
  learningTips: true,
  remediationLinks: true,
});

export const updateLandingPageSchema = insertLandingPageSchema.partial();

// Base campaign schema (no refinements) so we can reuse for update with partial()
const campaignBaseSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  targetGroupId: z.number().int().positive("Target group is required"),
  smtpProfileId: z.number().int().positive("SMTP profile is required"),
  emailTemplateId: z.number().int().positive("Email template is required"),
  landingPageId: z.number().int().positive("Landing page is required"),
  scheduledAt: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((d) => !(d instanceof Date) || !Number.isNaN(d.getTime()), { message: 'Invalid scheduledAt date format' })
    .optional(),
  endDate: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((d) => !(d instanceof Date) || !Number.isNaN(d.getTime()), { message: 'Invalid endDate date format' })
    .optional(),
});

export const insertCampaignSchema = campaignBaseSchema
  .refine(
    (data) => {
      if (!data.scheduledAt || !data.endDate) return true;
      return data.scheduledAt < data.endDate;
    },
    { message: 'scheduledAt must be before endDate', path: ['endDate'] }
  )
  .refine(
    (data) => {
      if (!data.scheduledAt) return true;
      return data.scheduledAt.getTime() >= Date.now() - 60_000;
    },
    { message: 'scheduledAt must be in the future', path: ['scheduledAt'] }
  )
  .refine(
    (data) => {
      if (!data.endDate) return true;
      return data.endDate.getTime() >= Date.now() - 60_000;
    },
    { message: 'endDate must be in the future', path: ['endDate'] }
  );

export const updateCampaignSchema = campaignBaseSchema.partial()
  .refine(
    (data) => {
      if (!data.scheduledAt || !data.endDate) return true;
      return data.scheduledAt < data.endDate;
    },
    { message: 'scheduledAt must be before endDate', path: ['endDate'] }
  )
  .refine(
    (data) => {
      if (!data.scheduledAt) return true;
      return data.scheduledAt.getTime() >= Date.now() - 60_000;
    },
    { message: 'scheduledAt must be in the future', path: ['scheduledAt'] }
  )
  .refine(
    (data) => {
      if (!data.endDate) return true;
      return data.endDate.getTime() >= Date.now() - 60_000;
    },
    { message: 'endDate must be in the future', path: ['endDate'] }
  );

export const insertCampaignResultSchema = createInsertSchema(campaignResults).pick({
  campaignId: true,
  targetId: true,
  status: true,
  sent: true,
  sentAt: true,
  opened: true,
  openedAt: true,
  clicked: true,
  clickedAt: true,
  submitted: true,
  submittedAt: true,
  submittedData: true,
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Enrollment acceptance schema
export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Employee portal validation schemas moved below table definitions

// Reconnaissance tables
export const reconnaissanceDomains = pgTable("reconnaissance_domains", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  emailFormats: jsonb("email_formats"), // Array of detected email format patterns
  mxRecords: jsonb("mx_records"), // Array of MX records
  txtRecords: jsonb("txt_records"), // Array of TXT records
  subdomains: jsonb("subdomains"), // Array of discovered subdomains
  discoveryStatus: varchar("discovery_status", { length: 50 }).default('pending'),
  discoveredAt: timestamp("discovered_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const discoveredContacts = pgTable("discovered_contacts", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id").references(() => reconnaissanceDomains.id, { onDelete: 'cascade' }).notNull(),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  fullName: varchar("full_name", { length: 255 }),
  title: varchar("title", { length: 200 }),
  company: varchar("company", { length: 200 }),
  linkedinUrl: text("linkedin_url"),
  source: varchar("source", { length: 50 }).notNull(),
  confidence: varchar("confidence", { length: 10 }).default('0.5'),
  verificationStatus: varchar("verification_status", { length: 50 }).default('unverified'),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiProfiles = pgTable("ai_profiles", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => discoveredContacts.id, { onDelete: 'cascade' }).notNull(),
  summary: text("summary"),
  interests: jsonb("interests"), // Array of interests
  workStyle: text("work_style"),
  vulnerabilities: jsonb("vulnerabilities"), // Array of potential vulnerabilities
  recommendedApproach: text("recommended_approach"),
  profileData: jsonb("profile_data"), // Full AI response for flexibility
  generatedAt: timestamp("generated_at").defaultNow(),
  modelUsed: varchar("model_used", { length: 50 }).default('gemini-pro'),
});

export const aiPretexts = pgTable("ai_pretexts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => aiProfiles.id, { onDelete: 'cascade' }).notNull(),
  pretextType: varchar("pretext_type", { length: 50 }).notNull(),
  subject: text("subject"),
  content: text("content"),
  tone: varchar("tone", { length: 50 }),
  urgency: varchar("urgency", { length: 50 }),
  personalization: jsonb("personalization"),
  approved: boolean("approved").default(false),
  generatedAt: timestamp("generated_at").defaultNow(),
  modelUsed: varchar("model_used", { length: 50 }).default('gemini-pro'),
});

export const scrapedContent = pgTable("scraped_content", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id").references(() => reconnaissanceDomains.id, { onDelete: 'cascade' }).notNull(),
  url: text("url").notNull(),
  title: text("title"),
  content: text("content"),
  markdownContent: text("markdown_content"),
  extractedContacts: jsonb("extracted_contacts"),
  scrapedAt: timestamp("scraped_at").defaultNow(),
  contentType: varchar("content_type", { length: 100 }),
});

export const contactSources = pgTable("contact_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  apiEndpoint: text("api_endpoint"),
  isActive: boolean("is_active").default(true),
  rateLimit: integer("rate_limit"),
  cost: varchar("cost", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reconnaissanceJobs = pgTable("reconnaissance_jobs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  status: varchar("status", { length: 50 }).default('pending'),
  progress: integer("progress").default(0),
  totalSteps: integer("total_steps").default(0),
  currentStep: text("current_step"),
  results: jsonb("results"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
});

// ========================================
// EMPLOYEE PORTAL TABLES
// ========================================

// Training modules (videos, courses, microlearning content)
export const trainingModules = pgTable("training_modules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // 'phishing', 'passwords', 'social_engineering', 'data_protection', etc.
  difficulty: varchar("difficulty", { length: 50 }).default('beginner').notNull(), // 'beginner', 'intermediate', 'advanced'
  durationMinutes: integer("duration_minutes").notNull(),
  videoUrl: text("video_url"), // YouTube URL or direct video file URL
  thumbnailUrl: text("thumbnail_url"),
  transcript: text("transcript"), // Video transcript for accessibility and search
  tags: jsonb("tags").default([]), // Array of tags for search/filtering
  isRequired: boolean("is_required").default(false).notNull(),
  passingScore: integer("passing_score").default(80), // Minimum score to pass associated quiz
  orderIndex: integer("order_index").default(0), // For sequential courses
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Training progress tracking for each user
export const trainingProgress = pgTable("training_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  moduleId: integer("module_id").references(() => trainingModules.id, { onDelete: 'cascade' }).notNull(),
  status: varchar("status", { length: 50 }).default('not_started').notNull(), // 'not_started', 'in_progress', 'completed'
  progressPercentage: integer("progress_percentage").default(0).notNull(),
    videoTimestamp: integer("video_timestamp").default(0), // Video playback position in seconds
  completedAt: timestamp("completed_at"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quizzes/assessments
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  moduleId: integer("module_id").references(() => trainingModules.id, { onDelete: 'cascade' }), // Optional: link to training module
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").default(80).notNull(),
  timeLimit: integer("time_limit"), // Time limit in minutes (null = no limit)
  allowRetakes: boolean("allow_retakes").default(true).notNull(),
  maxAttempts: integer("max_attempts").default(3), // null = unlimited
  randomizeQuestions: boolean("randomize_questions").default(false).notNull(),
  showCorrectAnswers: boolean("show_correct_answers").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quiz questions (supports multiple question types)
export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  questionType: varchar("question_type", { length: 50 }).notNull(), // 'multiple_choice', 'true_false', 'fill_blank', 'matching', 'scenario'
  questionText: text("question_text").notNull(),
  questionImage: text("question_image"), // Optional image URL
  options: jsonb("options").default([]), // Array of answer options for multiple choice
  correctAnswer: jsonb("correct_answer").notNull(), // Stores correct answer(s) - format varies by question type
  explanation: text("explanation"), // Explanation shown after answering
  points: integer("points").default(1).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quiz attempts (track each time a user takes a quiz)
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  score: integer("score"), // Final score (percentage 0-100)
  totalQuestions: integer("total_questions").notNull(),
  correctAnswers: integer("correct_answers"),
  answers: jsonb("answers").default({}), // Stores user's answers: { questionId: userAnswer }
  passed: boolean("passed").default(false).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  timeSpent: integer("time_spent"), // Time spent in seconds
});

// Certificates earned by users
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  moduleId: integer("module_id").references(() => trainingModules.id, { onDelete: 'cascade' }),
  quizId: integer("quiz_id").references(() => quizzes.id, { onDelete: 'cascade' }),
  certificateType: varchar("certificate_type", { length: 100 }).notNull(), // 'training_completion', 'quiz_mastery', 'course_completion'
  title: text("title").notNull(),
  description: text("description"),
  verificationCode: varchar("verification_code", { length: 50 }).notNull().unique(), // Unique code for verification
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // null = never expires
  pdfUrl: text("pdf_url"), // URL to generated PDF certificate
});

// Gamification: User points
export const userPoints = pgTable("user_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  totalPoints: integer("total_points").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(), // Consecutive days of activity
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActivityDate: timestamp("last_activity_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Gamification: Badges/achievements
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  category: varchar("category", { length: 100 }).notNull(), // 'milestone', 'streak', 'mastery', 'special'
  criteria: jsonb("criteria").notNull(), // JSON object defining how to earn this badge
  pointsAwarded: integer("points_awarded").default(0).notNull(),
  rarity: varchar("rarity", { length: 50 }).default('common').notNull(), // 'common', 'rare', 'epic', 'legendary'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User badges (many-to-many: users can earn multiple badges)
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  badgeId: integer("badge_id").references(() => badges.id, { onDelete: 'cascade' }).notNull(),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

// Articles/resources for employee learning
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown or HTML content
  excerpt: text("excerpt"),
  category: varchar("category", { length: 100 }).notNull(),
  tags: jsonb("tags").default([]),
  thumbnailUrl: text("thumbnail_url"),
  author: integer("author").references(() => users.id),
  readTimeMinutes: integer("read_time_minutes"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Flashcard decks for quick learning
export const flashcardDecks = pgTable("flashcard_decks", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Individual flashcards
export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").references(() => flashcardDecks.id, { onDelete: 'cascade' }).notNull(),
  frontContent: text("front_content").notNull(), // Question/term
  backContent: text("back_content").notNull(), // Answer/definition
  orderIndex: integer("order_index").default(0).notNull(),
});

// ========================================
// EMPLOYEE PORTAL VALIDATION SCHEMAS (after table declarations)
// ========================================

export const insertTrainingModuleSchema = createInsertSchema(trainingModules, {
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"], {
    errorMap: () => ({ message: "Difficulty must be beginner, intermediate, or advanced" })
  }),
  durationMinutes: z.number().int().positive("Duration must be a positive number"),
  passingScore: z.number().int().min(0).max(100).optional(),
  orderIndex: z.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateTrainingModuleSchema = insertTrainingModuleSchema.partial();

export const insertQuizSchema = createInsertSchema(quizzes, {
  title: z.string().min(1, "Title is required"),
  passingScore: z.number().int().min(0).max(100, "Passing score must be between 0 and 100"),
  timeLimit: z.number().int().positive("Time limit must be a positive number").optional().nullable(),
  maxAttempts: z.number().int().positive("Max attempts must be a positive number").optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateQuizSchema = insertQuizSchema.partial();

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions, {
  questionText: z.string().min(1, "Question text is required"),
  questionType: z.enum(["multiple_choice", "true_false", "fill_blank", "matching", "scenario"], {
    errorMap: () => ({ message: "Invalid question type" })
  }),
  options: z.array(z.string()).min(1, "At least one option is required").optional(),
  correctAnswer: z.any(),
  points: z.number().int().positive("Points must be a positive number").optional(),
  orderIndex: z.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true });

export const updateQuizQuestionSchema = insertQuizQuestionSchema.partial();

export const insertBadgeSchema = createInsertSchema(badges, {
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  criteria: z.any(),
  pointsAwarded: z.number().int().min(0).optional(),
  rarity: z.enum(["common", "rare", "epic", "legendary"], {
    errorMap: () => ({ message: "Rarity must be common, rare, epic, or legendary" })
  }).optional(),
}).omit({ id: true, createdAt: true });

export const updateBadgeSchema = insertBadgeSchema.partial();

export const insertArticleSchema = createInsertSchema(articles, {
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).optional(),
  readTimeMinutes: z.number().int().positive().optional().nullable(),
}).omit({ id: true, publishedAt: true, updatedAt: true });

export const updateArticleSchema = insertArticleSchema.partial();

export const insertFlashcardDeckSchema = createInsertSchema(flashcardDecks, {
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
}).omit({ id: true, createdAt: true });

export const updateFlashcardDeckSchema = insertFlashcardDeckSchema.partial();

export const insertFlashcardSchema = createInsertSchema(flashcards, {
  frontContent: z.string().min(1, "Front content is required"),
  backContent: z.string().min(1, "Back content is required"),
  orderIndex: z.number().int().min(0).optional(),
}).omit({ id: true });

export const updateFlashcardSchema = insertFlashcardSchema.partial();

// Default roles configuration
export const DEFAULT_ROLES = [
  {
    name: "Admin",
    description: "Full system access and user management",
    permissions: ["all"]
  },
  {
    name: "Manager", 
    description: "Campaign management and reporting",
    permissions: ["campaigns", "reports", "users:read"]
  },
  {
    name: "User",
    description: "Basic user access",
    permissions: ["campaigns:read", "reports:read"]
  }
];

// END OF FILE - Types already exported above
