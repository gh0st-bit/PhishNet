/**
 * Reporting Scheduler Service
 * Automatically generates and emails scheduled reports
 */

import { db } from '../db';
import { reportSchedules, campaigns, campaignResults, users } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

interface ReportData {
  organizationName: string;
  reportDate: string;
  dateRange: {
    from: string;
    to: string;
  };
  stats: {
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    totalTargets: number;
    emailsSent: number;
    emailsOpened: number;
    linksClicked: number;
    dataSubmitted: number;
    openRate: number;
    clickRate: number;
    submissionRate: number;
  };
  campaigns: any[];
  topRiskyUsers: any[];
}

class ReportingScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the scheduler to check for due reports every minute
   */
  start(checkIntervalMinutes: number = 1) {
    if (this.isRunning) {
      console.log('⚠️ Reporting scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(`📊 Starting reporting scheduler (checking every ${checkIntervalMinutes} minute(s))...`);

    // Run immediately on start
    this.checkAndRunDueReports();

    // Then run on interval
    this.intervalId = setInterval(
      () => this.checkAndRunDueReports(),
      checkIntervalMinutes * 60 * 1000
    );
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('📊 Reporting scheduler stopped');
  }

  /**
   * Check for due reports and process them
   */
  private async checkAndRunDueReports() {
    try {
      const now = new Date();
      
      // Find all enabled schedules that are due
      const dueSchedules = await db.select()
        .from(reportSchedules)
        .where(and(
          eq(reportSchedules.enabled, true),
          lte(reportSchedules.nextRunAt, now)
        ));

      if (dueSchedules.length === 0) {
        console.log('📊 No due reports at this time');
        return;
      }

      console.log(`📊 Found ${dueSchedules.length} due report(s) to generate`);

      // Process each schedule
      for (const schedule of dueSchedules) {
        try {
          await this.generateAndSendReport(schedule);
        } catch (error) {
          console.error(`❌ Error processing schedule ${schedule.id}:`, error);
          // Continue processing other schedules even if one fails
        }
      }
    } catch (error) {
      console.error('❌ Error checking due reports:', error);
    }
  }

  /**
   * Generate PDF and send via email for a specific schedule
   */
  private async generateAndSendReport(schedule: any) {
    console.log(`📧 Generating ${schedule.type} report for organization ${schedule.organizationId}...`);

    try {
      // Fetch report data
      const reportData = await this.fetchReportData(schedule.organizationId);

      // In production, this would generate the PDF and send it
      // For now, just log the action
      console.log(`📧 Would generate ${schedule.type} report with ${reportData.stats.totalCampaigns} campaigns`);
      console.log(`📧 Would send to: ${schedule.recipients}`);

      // Update schedule's last run and calculate next run
      const nextRun = this.calculateNextRun(schedule.cadence, schedule.timeOfDay);
      
      await db.update(reportSchedules)
        .set({
          lastRunAt: new Date(),
          nextRunAt: nextRun,
          updatedAt: new Date(),
        })
        .where(eq(reportSchedules.id, schedule.id));

      console.log(`✅ Report processed for schedule ${schedule.id}. Next run: ${nextRun.toISOString()}`);
    } catch (error) {
      console.error(`❌ Failed to generate/send report for schedule ${schedule.id}:`, error);
      throw error;
    }
  }

  /**
   * Fetch report data for an organization
   */
  private async fetchReportData(organizationId: number): Promise<ReportData> {
    try {
      // Get date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Fetch campaigns
      const orgCampaigns = await db.select()
        .from(campaigns)
        .where(eq(campaigns.organizationId, organizationId));

      // Fetch campaign results
      const allResults = orgCampaigns.length > 0 
        ? await db.select()
            .from(campaignResults)
            .where(
              sql`${campaignResults.campaignId} IN (${sql.join(orgCampaigns.map(c => sql`${c.id}`), sql`, `)})`
            )
        : [];

      // Calculate statistics
      const totalCampaigns = orgCampaigns.length;
      const activeCampaigns = orgCampaigns.filter(c => c.status === 'running').length;
      const completedCampaigns = orgCampaigns.filter(c => c.status === 'completed').length;
      
      const emailsSent = allResults.length;
      const emailsOpened = allResults.filter(r => r.opened).length;
      const linksClicked = allResults.filter(r => r.clicked).length;
      const dataSubmitted = allResults.filter(r => r.submittedData).length;
      
      const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
      const clickRate = emailsSent > 0 ? (linksClicked / emailsSent) * 100 : 0;
      const submissionRate = emailsSent > 0 ? (dataSubmitted / emailsSent) * 100 : 0;

      // Get organization name
      const orgUsers = await db.select()
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .limit(1);
      
      const organizationName = orgUsers[0]?.firstName ? 
        `${orgUsers[0].firstName}'s Organization` : 
        `Organization ${organizationId}`;

      return {
        organizationName,
        reportDate: new Date().toLocaleDateString('en-US'),
        dateRange: {
          from: startDate.toLocaleDateString('en-US'),
          to: endDate.toLocaleDateString('en-US'),
        },
        stats: {
          totalCampaigns,
          activeCampaigns,
          completedCampaigns,
          totalTargets: emailsSent,
          emailsSent,
          emailsOpened,
          linksClicked,
          dataSubmitted,
          openRate,
          clickRate,
          submissionRate,
        },
        campaigns: [],
        topRiskyUsers: [],
      };
    } catch (error) {
      console.error('Error fetching report data:', error);
      throw error;
    }
  }

  /**
   * Send report via email
   * (Placeholder - will integrate with actual email service)
   */
  private async sendReportEmail(schedule: any, reportData: ReportData): Promise<void> {
    console.log(`📧 Sending report to: ${schedule.recipients}`);
    console.log(`📧 Subject: ${schedule.type} Security Report - ${reportData.organizationName}`);
    console.log(`📧 Recipients: ${schedule.recipients.split(',').join(', ')}`);
    
    // In production, this would use the email-service.ts to send via SMTP
    // with PDF attachment generated on the server side
  }

  /**
   * Calculate the next run time based on cadence
   */
  private calculateNextRun(cadence: string, timeOfDay: string): Date {
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (cadence) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }

    return nextRun;
  }
}

// Export singleton instance
export const reportingScheduler = new ReportingScheduler();
