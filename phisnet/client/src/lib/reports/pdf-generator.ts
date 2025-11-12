/**
 * PDF Report Generation System
 * Generates executive and detailed reports for PhishNet campaigns
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types for report data
export interface CampaignStats {
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
}

export interface CampaignDetail {
  name: string;
  status: string;
  targetCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  submittedCount: number;
  openRate: number;
  clickRate: number;
  submissionRate: number;
  createdAt: string;
}

export interface ReportData {
  organizationName: string;
  reportDate: string;
  dateRange: {
    from: string;
    to: string;
  };
  stats: CampaignStats;
  campaigns: CampaignDetail[];
  topRiskyUsers?: Array<{
    name: string;
    email: string;
    clicks: number;
    submissions: number;
  }>;
}

export interface ReportOptions {
  type: 'executive' | 'detailed' | 'compliance';
  includeCharts?: boolean;
  includeCampaignDetails?: boolean;
  includeRiskyUsers?: boolean;
  customLogo?: string; // Base64 encoded logo
  customColors?: {
    primary: string;
    secondary: string;
  };
}

/**
 * Generate PDF Report
 */
export async function generatePDFReport(
  data: ReportData,
  options: ReportOptions = { type: 'executive' }
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  const colors = options.customColors || {
    primary: '#2563eb', // Blue
    secondary: '#64748b' // Slate
  };

  let yPosition = 20;

  // Header with Logo
  if (options.customLogo) {
    try {
      doc.addImage(options.customLogo, 'PNG', 15, 10, 30, 30);
      yPosition = 45;
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  // Title
  doc.setFontSize(24);
  doc.setTextColor(colors.primary);
  doc.text('PhishNet Security Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor('#666666');
  doc.text(
    `${options.type.charAt(0).toUpperCase() + options.type.slice(1)} Report`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 5;

  doc.text(data.organizationName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;

  doc.text(
    `Report Generated: ${data.reportDate}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 5;

  doc.text(
    `Period: ${data.dateRange.from} to ${data.dateRange.to}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 15;

  // Divider line
  doc.setDrawColor(colors.secondary);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 10;

  // Executive Summary Section
  doc.setFontSize(16);
  doc.setTextColor(colors.primary);
  doc.text('Executive Summary', 15, yPosition);
  yPosition += 10;

  // Key Metrics in a nice grid
  doc.setFontSize(10);
  doc.setTextColor('#000000');

  const metrics = [
    { label: 'Total Campaigns', value: data.stats.totalCampaigns.toString() },
    { label: 'Active Campaigns', value: data.stats.activeCampaigns.toString() },
    { label: 'Total Targets', value: data.stats.totalTargets.toLocaleString() },
    { label: 'Emails Sent', value: data.stats.emailsSent.toLocaleString() },
    { label: 'Emails Opened', value: data.stats.emailsOpened.toLocaleString() },
    { label: 'Links Clicked', value: data.stats.linksClicked.toLocaleString() },
    { label: 'Data Submitted', value: data.stats.dataSubmitted.toLocaleString() },
    { label: 'Open Rate', value: `${data.stats.openRate.toFixed(1)}%` },
    { label: 'Click Rate', value: `${data.stats.clickRate.toFixed(1)}%` },
    { label: 'Submission Rate', value: `${data.stats.submissionRate.toFixed(1)}%` },
  ];

  // Create metrics table
  autoTable(doc, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: metrics.map(m => [m.label, m.value]),
    theme: 'grid',
    headStyles: {
      fillColor: colors.primary,
      textColor: '#ffffff',
      fontSize: 11,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 80, halign: 'right', fontStyle: 'bold' }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Risk Assessment Section
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(16);
  doc.setTextColor(colors.primary);
  doc.text('Risk Assessment', 15, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setTextColor('#000000');

  // Risk level determination
  const riskLevel = 
    data.stats.submissionRate > 10 ? 'HIGH RISK' :
    data.stats.submissionRate > 5 ? 'MEDIUM RISK' :
    data.stats.clickRate > 20 ? 'MEDIUM RISK' : 'LOW RISK';

  const riskColor = 
    riskLevel === 'HIGH RISK' ? '#dc2626' :
    riskLevel === 'MEDIUM RISK' ? '#f59e0b' : '#16a34a';

  doc.setFontSize(14);
  doc.setTextColor(riskColor);
  doc.text(`Overall Risk Level: ${riskLevel}`, 15, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setTextColor('#000000');

  const recommendations = [];
  if (data.stats.submissionRate > 5) {
    recommendations.push('• High credential submission rate detected. Immediate security awareness training recommended.');
  }
  if (data.stats.clickRate > 15) {
    recommendations.push('• Click rate above threshold. Consider additional phishing awareness campaigns.');
  }
  if (data.stats.openRate < 30) {
    recommendations.push('• Low email open rate may indicate email filtering or user awareness improvements.');
  }
  if (recommendations.length === 0) {
    recommendations.push('• Security posture is good. Continue regular awareness training and phishing simulations.');
  }

  doc.text('Recommendations:', 15, yPosition);
  yPosition += 7;

  recommendations.forEach(rec => {
    doc.text(rec, 20, yPosition);
    yPosition += 7;
  });

  yPosition += 10;

  // Campaign Details Section (if included)
  if (options.includeCampaignDetails && data.campaigns.length > 0) {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(16);
    doc.setTextColor(colors.primary);
    doc.text('Campaign Details', 15, yPosition);
    yPosition += 10;

    const campaignTableData = data.campaigns.map(campaign => [
      campaign.name,
      campaign.status,
      campaign.targetCount.toString(),
      `${campaign.openRate.toFixed(1)}%`,
      `${campaign.clickRate.toFixed(1)}%`,
      `${campaign.submissionRate.toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Campaign', 'Status', 'Targets', 'Open Rate', 'Click Rate', 'Submit Rate']],
      body: campaignTableData,
      theme: 'striped',
      headStyles: {
        fillColor: colors.primary,
        textColor: '#ffffff',
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 25, halign: 'center' }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Risky Users Section (if included)
  if (options.includeRiskyUsers && data.topRiskyUsers && data.topRiskyUsers.length > 0) {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(16);
    doc.setTextColor(colors.primary);
    doc.text('High-Risk Users', 15, yPosition);
    yPosition += 7;

    doc.setFontSize(9);
    doc.setTextColor('#666666');
    doc.text('(Users who frequently click phishing links or submit credentials)', 15, yPosition);
    yPosition += 10;

    const riskyUsersData = data.topRiskyUsers.slice(0, 10).map(user => [
      user.name,
      user.email,
      user.clicks.toString(),
      user.submissions.toString()
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Name', 'Email', 'Link Clicks', 'Credentials Submitted']],
      body: riskyUsersData,
      theme: 'striped',
      headStyles: {
        fillColor: '#dc2626',
        textColor: '#ffffff',
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor('#999999');
    doc.text(
      `PhishNet Security Report - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'CONFIDENTIAL - For Internal Use Only',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Convert to Blob
  return doc.output('blob');
}

/**
 * Download PDF Report
 */
export async function downloadPDFReport(
  data: ReportData,
  options: ReportOptions = { type: 'executive' },
  filename?: string
): Promise<void> {
  const blob = await generatePDFReport(data, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `PhishNet-Report-${data.reportDate.replace(/\//g, '-')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
