/**
 * Shared TypeScript Types for PhishNet Frontend
 * This file contains type definitions used across the frontend application
 */

// Campaign Types
export interface Campaign {
  id: number;
  name: string;
  status: 'active' | 'draft' | 'completed' | 'paused' | 'scheduled';
  created_at: string;
  createdAt?: string;
  targets: number;
  opened: number;
  clicked: number;
  organizationId?: string;
  scheduledAt?: string | Date | null;
  endDate?: string | Date | null;
}

// Template Types
export interface Template {
  id: number;
  name: string;
  subject: string;
  html: string;
  text?: string;
  organizationId?: string;
}

// User Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  organizationId: string;
  created_at: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string | null;
}

// Dashboard Stats
export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  campaignChange: number;
  totalTargets: number;
  successRate: number;
  successRateChange: number;
  totalUsers: number;
  newUsers: number;
  trainingCompletion: number;
  trainingCompletionChange: number;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status: 'success' | 'error';
}

// Frontend-specific types
export interface MockApiConfig {
  baseUrl: string;
  timeout: number;
  mockData: boolean;
}

export interface FrontendConfig {
  apiUrl: string;
  appName: string;
  version: string;
  devMode: boolean;
  mockData: boolean;
}

// Additional interfaces for dashboard components
export interface DataPoint {
  date: string;
  opens: number;
  clicks: number;
  submissions: number;
}

export interface Threat {
  id: number;
  type: string;
  level: 'Low' | 'Medium' | 'High';
  count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RiskUser {
  id: number;
  name: string;
  email: string;
  riskScore: number;
  incidents: number;
}

export interface Training {
  id: number;
  title: string;
  completion: number;
  required: boolean;
}

// Enhanced interfaces to match frontend expectations
export interface Group {
  id: number;
  name: string;
  targetCount: number;
  lastUpdated: string;
}

export interface Target {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
}

export interface UserWithRoles extends User {
  roles?: Array<{ id: number; name: string }>;
}

export interface SmtpProfile {
  id: number;
  name: string;
  host: string;
  port: number;
  isDefault: boolean;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
}

export interface LandingPage {
  id: number;
  name: string;
  pageType: string;
  url: string;
  isActive: boolean;
  thumbnail?: string;
  description?: string;
  createdAt: string;
}
