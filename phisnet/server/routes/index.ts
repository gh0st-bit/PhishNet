import type { Express } from 'express';
import { registerHealthRoutes } from './health';
import { registerDashboardRoutes } from './dashboard';
import { registerNotificationRoutes } from './notifications';
import { registerThreatIntelligenceRoutes } from './threat-intelligence';
import { registerCampaignRoutes } from './campaigns';
import { registerUserRoutes } from './users';
import { registerGroupRoutes } from './groups';
import { registerSmtpProfileRoutes } from './smtp-profiles';
import { registerEmailTemplateRoutes } from './email-templates';
import { registerLandingPageRoutes } from './landing-pages';
import { registerReportRoutes } from './reports';
import { registerTrackingRoutes } from './tracking';

/**
 * Register all modular routes
 * This function is called from the main routes.ts file
 */
export function registerModularRoutes(app: Express) {
  // Core system routes
  registerHealthRoutes(app);
  
  // Dashboard routes
  registerDashboardRoutes(app);
  
  // Notification routes
  registerNotificationRoutes(app);
  
  // Threat Intelligence routes
  registerThreatIntelligenceRoutes(app);
  
  // Campaign routes
  registerCampaignRoutes(app);
  
  // User routes
  registerUserRoutes(app);
  
  // Groups and targets routes
  registerGroupRoutes(app);
  
  // SMTP profiles routes
  registerSmtpProfileRoutes(app);
  
  // Email templates routes
  registerEmailTemplateRoutes(app);
  
  // Landing pages routes
  registerLandingPageRoutes(app);
  
  // Reports routes
  registerReportRoutes(app);
  
  // Public tracking routes (must be last - no auth required)
  registerTrackingRoutes(app);
  
  console.log('✅ All modular routes registered');
}

// Re-export individual registration functions for flexibility
export { registerHealthRoutes } from './health';
export { registerDashboardRoutes } from './dashboard';
export { registerNotificationRoutes } from './notifications';
export { registerThreatIntelligenceRoutes } from './threat-intelligence';
export { registerCampaignRoutes } from './campaigns';
export { registerUserRoutes } from './users';
export { registerGroupRoutes } from './groups';
export { registerSmtpProfileRoutes } from './smtp-profiles';
export { registerEmailTemplateRoutes } from './email-templates';
export { registerLandingPageRoutes } from './landing-pages';
export { registerReportRoutes } from './reports';
export { registerTrackingRoutes } from './tracking';
