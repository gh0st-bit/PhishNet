/**
 * Reporting Scheduler Service
 * Automatically generates and emails scheduled reports
 */

import { db,pool } from '../db';
import { sendTransactionalMail } from './transactional-mail';
import { nextReportRun } from './report-cadence';
import { reportSchedules, campaigns, campaignResults, organizations } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

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
  async checkAndRunDueReports() {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows}=await client.query("SELECT * FROM report_schedules WHERE enabled AND next_run_at<=now() ORDER BY next_run_at LIMIT 20 FOR UPDATE SKIP LOCKED");
      for(const row of rows){
        await client.query(`INSERT INTO report_runs(schedule_id,organization_id,scheduled_for,snapshot) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[row.id,row.organization_id,row.next_run_at,JSON.stringify(row)]);
        const next=nextReportRun(row.cadence,row.time_of_day,row.timezone,new Date(),new Date(row.next_run_at));
        await client.query('UPDATE report_schedules SET next_run_at=$2,updated_at=now() WHERE id=$1',[row.id,next]);
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    // Generation is safe to retry; a process lost during SMTP submission requires reconciliation.
    await pool.query("UPDATE report_runs SET state=CASE WHEN state='sending' THEN 'ambiguous' WHEN attempts>=3 THEN 'failed' ELSE 'queued' END, error_code='LEASE_EXPIRED',updated_at=now() WHERE state IN ('generating','sending') AND lease_until<now()");
    const {rows:[job]}=await pool.query(`UPDATE report_runs SET state='generating',attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now()
      WHERE id=(SELECT id FROM report_runs WHERE state='queued' AND available_at<=now() ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`);
    if(!job)return false;
    let sending=false;
    try {
      const data=await this.fetchReportData(job.organization_id);
      const pdf=await this.generatePDF(job.snapshot.type,data);
      await pool.query("UPDATE report_runs SET state='sending',updated_at=now() WHERE id=$1",[job.id]);sending=true;
      await this.sendReportEmail(job.snapshot,data,pdf);
      await pool.query("UPDATE report_runs SET state='accepted',lease_until=NULL,error_code=NULL,updated_at=now() WHERE id=$1",[job.id]);
      await pool.query('UPDATE report_schedules SET last_run_at=now() WHERE id=$1',[job.schedule_id]);return true;
    }catch(error:any){
      const code=String(error.code||'GENERATION_FAILED');
      const safe=['MAIL_NOT_CONFIGURED','ECONNECTION','EDNS','EAUTH','ETLS'].includes(code);
      const state=sending&&!safe?'ambiguous':job.attempts>=3?'failed':'queued';
      await pool.query("UPDATE report_runs SET state=$2,error_code=$3,lease_until=NULL,available_at=now()+interval '5 minutes',updated_at=now() WHERE id=$1",[job.id,state,code]);return true;
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
        .where(and(eq(campaigns.organizationId, organizationId),sql`${campaigns.createdAt} >= ${startDate}`));

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
      const activeCampaigns = orgCampaigns.filter(c => c.status === 'Active').length;
      const completedCampaigns = orgCampaigns.filter(c => c.status === 'Completed').length;
      
      const acceptedResults=allResults.filter(r=>r.sent);
      const emailsSent = acceptedResults.length;
      const emailsOpened = acceptedResults.filter(r => r.opened).length;
      const linksClicked = acceptedResults.filter(r => r.clicked).length;
      const dataSubmitted = acceptedResults.filter(r => r.submitted).length;
      
      const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
      const clickRate = emailsSent > 0 ? (linksClicked / emailsSent) * 100 : 0;
      const submissionRate = emailsSent > 0 ? (dataSubmitted / emailsSent) * 100 : 0;

      // Get organization name
      const [organization]=await db.select({name:organizations.name}).from(organizations).where(eq(organizations.id,organizationId));
      const organizationName=organization?.name || 'Organization';

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
    // Parse recipients
    const recipients = schedule.recipients.split(',').map((r: string) => r.trim());
    
    // Send email
    await sendTransactionalMail({
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

}

export const reportingScheduler = new ReportingScheduler();
