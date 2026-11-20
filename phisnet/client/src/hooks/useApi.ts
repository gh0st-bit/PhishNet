/**
 * Typed React Query Hooks for PhishNet Frontend
 * Provides type-safe data fetching with proper error handling
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type {
  DashboardStatsResponse,
  PhishingMetricsResponse,
  ThreatsResponse,
  RiskUsersResponse,
  TrainingsResponse,
  CampaignsResponse,
  CampaignWithDetails,
  CampaignResultsResponse,
  TemplatesResponse,
  GroupsResponse,
  TargetsResponse,
  UsersResponse,
  RolesResponse,
  SmtpProfilesResponse,
  LandingPagesResponse,
  ReportsResponse,
  Notification
} from '@shared/types/api';

// Dashboard Hooks
export const useDashboardStats = () => {
  return useQuery<DashboardStatsResponse, Error>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiClient.getDashboardStats(),
  });
};

export const usePhishingMetrics = () => {
  return useQuery<PhishingMetricsResponse, Error>({
    queryKey: ['dashboard', 'phishing-metrics'],
    queryFn: () => apiClient.getPhishingMetrics(),
  });
};

export const useThreats = () => {
  return useQuery<ThreatsResponse, Error>({
    queryKey: ['dashboard', 'threats'],
    queryFn: () => apiClient.getThreats(),
  });
};

export const useRiskUsers = () => {
  return useQuery<RiskUsersResponse, Error>({
    queryKey: ['dashboard', 'risk-users'],
    queryFn: () => apiClient.getRiskUsers(),
  });
};

export const useTrainings = () => {
  return useQuery<TrainingsResponse, Error>({
    queryKey: ['dashboard', 'trainings'],
    queryFn: () => apiClient.getTrainings(),
  });
};

// Campaigns Hooks
export const useCampaigns = (page=1) => {
  const query = useQuery<CampaignsResponse, Error>({
    queryKey: ['/api/campaigns',{page}],
    queryFn: () => apiClient.getCampaigns(page),
  });
  
  return {
    ...query,
    pagination:query.data?.pagination,
    data: query.data?.campaigns || []  // Extract campaigns array
  };
};

export const useCampaign = (id: number | string | undefined) => {
  return useQuery<CampaignWithDetails, Error>({
    queryKey: ['/api/campaigns', id],
    queryFn: () => apiClient.getCampaign(Number(id)),
    enabled: !!id,
  });
};

export const useCampaignResults = (id: number | string | undefined) => {
  return useQuery<CampaignResultsResponse, Error>({
    refetchInterval:5000,
    queryKey: ['/api/campaigns', id, 'results'],
    queryFn: () => apiClient.getCampaignResults(Number(id)),
    enabled: !!id,
  });
};

// Templates Hook
export const useTemplates = () => {
  return useQuery<TemplatesResponse, Error>({
    queryKey: ['templates'],
    queryFn: () => apiClient.getTemplates(),
  });
};

// Groups and Targets Hooks
export const useGroups = () => {
  return useQuery<GroupsResponse, Error>({
    queryKey: ['/api/groups'],
    queryFn: () => apiClient.getGroups(),
  });
};

export const useTargets = () => {
  return useQuery<TargetsResponse, Error>({
    queryKey: ['targets'],
    queryFn: () => apiClient.getTargets(),
  });
};

// Users Hooks
export const useUsers = () => {
  return useQuery<UsersResponse, Error>({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers(),
  });
};

export const useRoles = () => {
  return useQuery<RolesResponse, Error>({
    queryKey: ['roles'],
    queryFn: () => apiClient.getRoles(),
  });
};

// SMTP Profiles Hook
export const useSmtpProfiles = () => {
  return useQuery<SmtpProfilesResponse, Error>({
    queryKey: ['/api/smtp-profiles'],
    queryFn: () => apiClient.getSmtpProfiles(),
  });
};

// Landing Pages Hook
export const useLandingPages = () => {
  return useQuery<LandingPagesResponse, Error>({
    queryKey: ['/api/landing-pages'],
    queryFn: () => apiClient.getLandingPages(),
  });
};

// Reports Hook
export const useReports = () => {
  return useQuery<ReportsResponse, Error>({
    queryKey: ['reports'],
    queryFn: () => apiClient.getReports(),
  });
};

// Campaign Details Hook
export const useCampaignDetails = (id: number) => {
  return useQuery<CampaignWithDetails, Error>({
    queryKey: ['campaign-details', id],
    queryFn: () => apiClient.getCampaign(id),
    enabled: !!id,
  });
};

// Notifications Hook
export const useNotifications = () => {
  return useQuery<Notification[], Error>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.getNotifications(),
  });
};

// Helper function to extract data with proper typing
export const useTypedData = <T>(queryResult: { data?: T; isLoading: boolean; error: Error | null }) => {
  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
  };
};
