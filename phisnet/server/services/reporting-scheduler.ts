/**
 * Reporting Scheduler Service
 * Automatically generates and emails scheduled reports
 */

import { db } from '../db';
import { reportSchedules, campaigns, campaignResults, users, smtpProfiles, organizations } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

      // Generate PDF
      const pdfBuffer = await this.generatePDF(schedule.type, reportData);

      // Send email with PDF attachment
      await this.sendReportEmail(schedule, reportData, pdfBuffer);

      // Update schedule's last run and calculate next run
      const nextRun = this.calculateNextRun(schedule.cadence, schedule.timeOfDay);
      
      await db.update(reportSchedules)
        .set({
          lastRunAt: new Date(),
          nextRunAt: nextRun,
          updatedAt: new Date(),
        })
        .where(eq(reportSchedules.id, schedule.id));

      console.log(`✅ Report sent successfully for schedule ${schedule.id}. Next run: ${nextRun.toISOString()}`);
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
   * Generate PDF report
   */
  private async generatePDF(reportType: string, data: ReportData): Promise<Buffer> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text('PhishNet Security Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, pageWidth / 2, 28, { align: 'center' });
    
    // Organization and date
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Organization: ${data.organizationName}`, 14, 40);
    doc.text(`Generated: ${data.reportDate}`, 14, 46);
    doc.text(`Period: ${data.dateRange.from} - ${data.dateRange.to}`, 14, 52);
    
    // Key Metrics
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Key Metrics', 14, 65);
    
    autoTable(doc, {
      startY: 70,
      head: [['Metric', 'Value']],
      body: [
        ['Total Campaigns', data.stats.totalCampaigns.toString()],
        ['Active Campaigns', data.stats.activeCampaigns.toString()],
        ['Completed Campaigns', data.stats.completedCampaigns.toString()],
        ['Emails Sent', data.stats.emailsSent.toString()],
        ['Open Rate', `${data.stats.openRate.toFixed(1)}%`],
        ['Click Rate', `${data.stats.clickRate.toFixed(1)}%`],
        ['Submission Rate', `${data.stats.submissionRate.toFixed(1)}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    // Risk Assessment
    const finalY = (doc as any).lastAutoTable.finalY || 140;
    doc.setFontSize(14);
    doc.text('Risk Assessment', 14, finalY + 15);
    
    doc.setFontSize(10);
    let riskLevel = 'Low';
    if (data.stats.submissionRate > 15) riskLevel = 'Critical';
    else if (data.stats.submissionRate > 10) riskLevel = 'High';
    else if (data.stats.submissionRate > 5) riskLevel = 'Medium';
    
    doc.text(`Overall Risk Level: ${riskLevel}`, 14, finalY + 22);
    doc.text(`Analysis: ${data.stats.submissionRate.toFixed(1)}% of targets submitted credentials`, 14, finalY + 28);
    
    // Recommendations
    doc.text('Recommendations:', 14, finalY + 38);
    doc.setFontSize(9);
    doc.text('• Continue regular phishing simulations', 16, finalY + 44);
    doc.text('• Target high-risk users for additional training', 16, finalY + 50);
    doc.text('• Review security policies quarterly', 16, finalY + 56);
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Page ${i} of ${pageCount} | PhishNet © ${new Date().getFullYear()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Send report via email with PDF attachment
   */
  private async sendReportEmail(schedule: any, reportData: ReportData, pdfBuffer: Buffer): Promise<void> {
    // Get organization's SMTP profile
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, schedule.organizationId))
      .limit(1);
    
    if (!org) {
      throw new Error(`Organization ${schedule.organizationId} not found`);
    }
    
    // Get first available SMTP profile for this organization
    const [smtpProfile] = await db.select()
      .from(smtpProfiles)
      .where(eq(smtpProfiles.organizationId, schedule.organizationId))
      .limit(1);
    
    if (!smtpProfile) {
      throw new Error(`No SMTP profile configured for organization ${schedule.organizationId}`);
    }
    
    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: smtpProfile.host,
      port: smtpProfile.port,
      secure: smtpProfile.port === 465,
      auth: {
        user: smtpProfile.username,
        pass: smtpProfile.password,
      },
    });
    
    // Parse recipients
    const recipients = schedule.recipients.split(',').map((r: string) => r.trim());
    
    // Send email
    await transporter.sendMail({
      from: `${smtpProfile.fromName} <${smtpProfile.fromEmail}>`,
      to: recipients.join(', '),
      subject: `${schedule.type.charAt(0).toUpperCase() + schedule.type.slice(1)} Security Report - ${reportData.organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">PhishNet Security Report</h2>
          <p>Hello,</p>
          <p>Your scheduled <strong>${schedule.type}</strong> security report is ready.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Key Highlights</h3>
            <ul style="margin: 10px 0;">
              <li><strong>Total Campaigns:</strong> ${reportData.stats.totalCampaigns}</li>
              <li><strong>Open Rate:</strong> ${reportData.stats.openRate.toFixed(1)}%</li>
              <li><strong>Click Rate:</strong> ${reportData.stats.clickRate.toFixed(1)}%</li>
              <li><strong>Submission Rate:</strong> ${reportData.stats.submissionRate.toFixed(1)}%</li>
            </ul>
          </div>
          
          <p>The full report is attached as a PDF file.</p>
          
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated report from PhishNet. Report period: ${reportData.dateRange.from} - ${reportData.dateRange.to}
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `phishnet-report-${reportData.reportDate.replace(/\//g, '-')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
    
    console.log(`✅ Email sent successfully to ${recipients.length} recipient(s)`);
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
