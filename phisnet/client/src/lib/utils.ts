import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Campaign, CampaignResult } from '@shared/types/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Type-safe utility functions for PhishNet Frontend
 */

// Type guards
export const isArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

export const isCampaignArray = (value: unknown): value is Campaign[] => {
  return isArray<Campaign>(value) && value.every(item => 
    typeof item === 'object' && item !== null && 'id' in item
  );
};

export const isCampaignResultArray = (value: unknown): value is CampaignResult[] => {
  return isArray<CampaignResult>(value) && value.every(item => 
    typeof item === 'object' && item !== null && 'id' in item && 'sent' in item
  );
};

// Safe data extraction with defaults
export const safeExtractArray = <T>(data: unknown, fallback: T[] = []): T[] => {
  if (isArray<T>(data)) {
    return data;
  }
  return fallback;
};

export const safeExtractObject = <T extends Record<string, any>>(
  data: unknown, 
  fallback: Partial<T> = {}
): T => {
  if (typeof data === 'object' && data !== null) {
    return { ...fallback, ...data } as T;
  }
  return fallback as T;
};

// Calculate display status based on campaign schedule and current time
export const getDisplayStatus = (campaign: Partial<Campaign>): "active" | "draft" | "completed" | "scheduled" | "paused" => {
  const baseStatus = (campaign.status?.toLowerCase() || 'draft') as "active" | "draft" | "completed" | "scheduled" | "paused";
  
  if (!campaign.scheduledAt || !campaign.endDate) {
    return baseStatus;
  }
  
  try {
    const startDate = new Date(campaign.scheduledAt);
    const endDate = new Date(campaign.endDate);
    const now = new Date();
    
    // If we're past the end date, it's completed
    if (now >= endDate) {
      return 'completed';
    }
    
    // If we're between start and end date, it's active
    if (now >= startDate) {
      return 'active';
    }
    
    // Otherwise keep the original status (likely 'scheduled' or 'draft')
    return baseStatus;
  } catch {
    return baseStatus;
  }
};

// Badge variant helper
export const getBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" | "success" | "info" => {
  const variants: Record<string, "default" | "destructive" | "outline" | "secondary" | "success" | "info"> = {
    "Active": "success",
    "Scheduled": "info",
    "Completed": "secondary",
    "Draft": "outline",
    "active": "success",
    "scheduled": "info", 
    "completed": "secondary",
    "draft": "outline"
  };
  
  return variants[status] || "outline";
};

// Safe string conversion
export const safeToString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (value === null || value === undefined) return '';
  return String(value);
};

// Safe date formatting
export const formatDateTime = (value: unknown): string => {
  if (!value) return '';
  
  try {
    const date = new Date(value as string);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16); // Format for datetime-local input
  } catch {
    return '';
  }
};

// Type-safe property access
export const safeGet = <T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback?: T[K]
): T[K] | undefined => {
  if (obj && typeof obj === 'object' && key in obj) {
    return obj[key];
  }
  return fallback;
};

// Extract campaigns from API response
export const extractCampaigns = (data: unknown): Campaign[] => {
  if (typeof data === 'object' && data !== null && 'campaigns' in data) {
    const campaigns = (data as { campaigns: unknown }).campaigns;
    return safeExtractArray<Campaign>(campaigns);
  }
  return safeExtractArray<Campaign>(data);
};

// Extract templates from API response  
export const extractTemplates = (data: unknown): any[] => {
  if (typeof data === 'object' && data !== null && 'templates' in data) {
    const templates = (data as { templates: unknown }).templates;
    return safeExtractArray(templates);
  }
  return safeExtractArray(data);
};
