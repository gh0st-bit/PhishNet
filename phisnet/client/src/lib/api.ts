/**
 * Typed API Client for PhishNet Frontend
 * Provides type-safe API calls with proper TypeScript interfaces
 */

import type {
  CampaignsResponse,
  TemplatesResponse,
  UsersResponse,
  GroupsResponse,
  TargetsResponse,
  SmtpProfilesResponse,
  LandingPagesResponse,
  RolesResponse,
  DashboardStatsResponse,
  PhishingMetricsResponse,
  ThreatsResponse,
  RiskUsersResponse,
  TrainingsResponse,
  ReportsResponse,
  CampaignResultsResponse,
  CampaignWithDetails,
  Notification
} from '@shared/types/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Dashboard API
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return this.fetch<DashboardStatsResponse>('/api/dashboard/stats');
  }

  async getPhishingMetrics(): Promise<PhishingMetricsResponse> {
    return this.fetch<PhishingMetricsResponse>('/api/dashboard/phishing-metrics');
  }

  async getThreats(): Promise<ThreatsResponse> {
    return this.fetch<ThreatsResponse>('/api/dashboard/threats');
  }

  async getRiskUsers(): Promise<RiskUsersResponse> {
    return this.fetch<RiskUsersResponse>('/api/dashboard/risk-users');
  }

  async getTrainings(): Promise<TrainingsResponse> {
    return this.fetch<TrainingsResponse>('/api/dashboard/trainings');
  }

  // Campaigns API
  async getCampaigns(): Promise<CampaignsResponse> {
    return this.fetch<CampaignsResponse>('/api/campaigns');
  }

  async getCampaign(id: number): Promise<CampaignWithDetails> {
    return this.fetch<CampaignWithDetails>(`/api/campaigns/${id}`);
  }

  async getCampaignResults(id: number): Promise<CampaignResultsResponse> {
    return this.fetch<CampaignResultsResponse>(`/api/campaigns/${id}/results`);
  }

  // Templates API
  async getTemplates(): Promise<TemplatesResponse> {
    return this.fetch<TemplatesResponse>('/api/email-templates');
  }

  // Groups and Targets API
  async getGroups(): Promise<GroupsResponse> {
    return this.fetch<GroupsResponse>('/api/groups');
  }

  async getTargets(): Promise<TargetsResponse> {
    return this.fetch<TargetsResponse>('/api/targets');
  }

  // Users API
  async getUsers(): Promise<UsersResponse> {
    return this.fetch<UsersResponse>('/api/users');
  }

  async getRoles(): Promise<RolesResponse> {
    return this.fetch<RolesResponse>('/api/roles');
  }

  // SMTP Profiles API
  async getSmtpProfiles(): Promise<SmtpProfilesResponse> {
    return this.fetch<SmtpProfilesResponse>('/api/smtp-profiles');
  }

  // Landing Pages API
  async getLandingPages(): Promise<LandingPagesResponse> {
    return this.fetch<LandingPagesResponse>('/api/landing-pages');
  }

  // Reports API
  async getReports(): Promise<ReportsResponse> {
    return this.fetch<ReportsResponse>('/api/reports');
  }

  // Notifications API
  async getNotifications(): Promise<Notification[]> {
    return this.fetch<Notification[]>('/api/notifications');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for use in components
export type * from '@shared/types/api';
