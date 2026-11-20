/**
 * API Response Types for PhishNet Frontend
 * This file contains type definitions for all API responses
 */

import type { 
  Campaign, 
  Template, 
  User, 
  DashboardStats, 
  DataPoint, 
  Threat, 
  RiskUser, 
  Training,
  Group,
  Target,
  SmtpProfile,
  LandingPage
} from './index';

// Re-export the types for easier importing
export type {
  Campaign,
  Template,
  User,
  DashboardStats,
  DataPoint,
  Threat,
  RiskUser,
  Training,
  Group,
  Target,
  SmtpProfile,
  LandingPage
};

// Additional specific types
export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority?: string;
  createdAt: string;
}

export interface CampaignResult {
  reported?: boolean;
  reportedAt?: string;
  id: number;
  sent: boolean;
  opened: boolean;
  clicked: boolean;
  submitted: boolean;
}

// Alias for backward compatibility
export type EmailTemplate = Template;
export type SMTPProfile = SmtpProfile;

// Generic API Response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status: 'success' | 'error';
}

// Specific API Response Types
export interface CampaignsResponse {
  campaigns: Campaign[];
  pagination?: {page:number;limit:number;total:number};
}

export interface TemplatesResponse {
  templates: Template[];
}

export interface UsersResponse extends Array<User> {}

export interface GroupsResponse extends Array<Group> {}

export interface TargetsResponse extends Array<Target> {}

export interface SmtpProfilesResponse extends Array<SmtpProfile> {}

export interface LandingPagesResponse extends Array<LandingPage> {}

export interface RolesResponse extends Array<{
  id: number;
  name: string;
}> {}

// Dashboard API Response Types
export interface DashboardStatsResponse extends DashboardStats {}

export interface PhishingMetricsResponse extends Array<DataPoint> {}

export interface ThreatsResponse extends Array<Threat> {}

export interface RiskUsersResponse extends Array<RiskUser> {}

export interface TrainingsResponse extends Array<Training> {}

// Reports API Response Type
export interface ReportsResponse {
  campaigns: Campaign[];
  users: User[];
  summary: {
    totalEmails: number;
    delivered: number;
    opened: number;
    clicked: number;
    reported: number;
  };
}

// Campaign Results Response
export interface CampaignResult {
  id: number;
  campaignId: number;
  targetId: number;
  sent: boolean;
  opened: boolean;
  clicked: boolean;
  submitted: boolean;
  timestamp: string;
}

export interface CampaignResultsResponse extends Array<CampaignResult> {}

// Enhanced Campaign type with additional properties
export interface CampaignWithDetails extends Campaign {
  targetGroupId: number;
  smtpProfileId: number;
  emailTemplateId: number;
  landingPageId: number;
  scheduledAt?: string;
  createdAt: string;
  endDate?: string;
  targetGroup?: string;
  totalTargets?: number;
  emailTemplate?: { name: string };
  landingPage?: { name: string };
  smtpProfile?: { name: string };
  createdBy?: string;
}
