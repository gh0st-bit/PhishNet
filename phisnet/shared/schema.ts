import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations table (for multi-tenancy)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertLandingPageSchema = createInsertSchema(landingPages).pick({
  name: true,
  description: true,
  htmlContent: true,
  redirectUrl: true,
  pageType: true,
  thumbnail: true,
  captureData: true,
  capturePasswords: true,
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
    .refine((d) => !(d instanceof Date) || !isNaN(d.getTime()), { message: 'Invalid scheduledAt date format' })
    .optional(),
  endDate: z
    .union([z.string(), z.date()])
    .transform((val) => (typeof val === 'string' ? new Date(val) : val))
    .refine((d) => !(d instanceof Date) || !isNaN(d.getTime()), { message: 'Invalid endDate date format' })
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
