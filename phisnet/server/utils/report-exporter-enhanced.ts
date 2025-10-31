import { format } from 'date-fns';
import path from 'node:path';
import fs from 'node:fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export interface ReportData {
  campaigns?: any[];
  users?: any[];
  results?: any[];
  type: 'campaigns' | 'users' | 'results' | 'comprehensive';
  organizationName?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  summary?: {
    totalCampaigns: number;
    totalEmailsSent: number;
    successRate: number;
    atRiskUsers: number;
  };
  chartData?: any;
  theme?: 'light' | 'dark'; // Add theme parameter
}

export type ExportFormat = 'pdf' | 'xlsx' | 'json' | 'csv';

export async function exportReport(
  data: ReportData,
  exportFormat: ExportFormat = 'pdf'
): Promise<string> {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  
  let extension: string;
  if (exportFormat === 'xlsx') {
    extension = 'xlsx';
  } else if (exportFormat === 'json') {
    extension = 'json';
  } else if (exportFormat === 'csv') {
    extension = 'csv';
  } else {
    extension = 'pdf';
  }
  
  const filename = `${data.type}_report_${timestamp}.${extension}`;

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filepath = path.join(uploadsDir, filename);

  switch (exportFormat) {
    case 'pdf':
      await exportToPDF(data, filepath);
      break;
    case 'xlsx':
      await exportToXLSX(data, filepath);
      break;
    case 'json':
      await exportToJSON(data, filepath);
      break;
    case 'csv':
      // Keep backward compatibility
      await exportToCSV(data, filepath);
      break;
    default:
      throw new Error(`Unsupported format: ${exportFormat}`);
  }

  return filename;
}

// ============================================
// PDF EXPORT - Professional Template
// ============================================
async function exportToPDF(data: ReportData, filepath: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 20;

  // Determine which logo to use based on theme
  const theme = data.theme || 'dark'; // Default to dark if not specified
  const logoFilename = theme === 'dark' ? 'PhishNet_dark.png' : 'PhishNet_light.png';

  // Header with Branding - Orange Theme
  doc.setFillColor(255, 140, 0); // Orange header
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Add PhishNet Logo (theme-aware)
  try {
    const logoPath = path.join(process.cwd(), 'client', 'src', 'assets', logoFilename);
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
      doc.addImage(logoBase64, 'PNG', 14, 8, 30, 30);
    }
  } catch (error) {
    console.error('Error loading logo:', error);
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PhishNet Security Report', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.organizationName || 'Organization', pageWidth / 2, 32, { align: 'center' });

  // Reset text color for body
  doc.setTextColor(0, 0, 0);
  currentY = 55;

  // Report Information
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report Type: ${capitalizeReportType(data.type)}`, 14, currentY);
  currentY += 6;
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}`, 14, currentY);
  currentY += 6;
  
  if (data.dateRange) {
    doc.text(
      `Period: ${format(data.dateRange.start, 'MMM dd, yyyy')} - ${format(data.dateRange.end, 'MMM dd, yyyy')}`,
      14,
      currentY
    );
    currentY += 6;
  }
  
  currentY += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 10;

  // Executive Summary (if available)
  if (data.summary) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 14, currentY);
    currentY += 10;

    const summaryData = [
      ['Total Campaigns', data.summary.totalCampaigns.toString()],
      ['Total Emails Sent', data.summary.totalEmailsSent.toString()],
      ['Success Rate', `${data.summary.successRate}%`],
      ['At-Risk Users', data.summary.atRiskUsers.toString()],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 140, 0], // Orange
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 10,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Campaigns Section
  if (data.campaigns && data.campaigns.length > 0) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Campaign Details', 14, currentY);
    currentY += 10;

    const campaignRows = data.campaigns.map((campaign) => [
      campaign.name || 'Unknown',
      campaign.status || 'Unknown',
      campaign.createdAt
        ? format(new Date(campaign.createdAt), 'MMM dd, yyyy')
        : 'N/A',
      campaign.scheduledAt
        ? format(new Date(campaign.scheduledAt), 'MMM dd, yyyy')
        : 'Not Scheduled',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Campaign Name', 'Status', 'Created', 'Scheduled']],
      body: campaignRows,
      theme: 'striped',
      headStyles: {
        fillColor: [255, 140, 0], // Orange
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Users Section
  if (data.users && data.users.length > 0) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('User Details', 14, currentY);
    currentY += 10;

    const userRows = data.users.slice(0, 50).map((user) => [
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
      user.email || 'N/A',
      user.role || 'User',
      user.createdAt
        ? format(new Date(user.createdAt), 'MMM dd, yyyy')
        : 'N/A',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Name', 'Email', 'Role', 'Created']],
      body: userRows,
      theme: 'striped',
      headStyles: {
        fillColor: [255, 140, 0], // Orange
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    if (data.users.length > 50) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(`Showing 50 of ${data.users.length} users`, 14, currentY);
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.height - 15;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `PhishNet Security Platform | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.text(
      `Generated on ${format(new Date(), 'MMM dd, yyyy')}`,
      pageWidth - 14,
      footerY,
      { align: 'right' }
    );
  }

  doc.save(filepath);
}

// ============================================
// XLSX EXPORT - Multi-Sheet Workbook
// ============================================
async function exportToXLSX(data: ReportData, filepath: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PhishNet Security Platform';
  workbook.created = new Date();

  // Summary Sheet
  if (data.summary) {
    const summarySheet = workbook.addWorksheet('Summary');
    
    // Title row
    summarySheet.addRow(['PhishNet Security Report']);
    summarySheet.getRow(1).font = { size: 16, bold: true };
    
    // Metadata
    summarySheet.addRow(['Organization', data.organizationName || 'Unknown']);
    summarySheet.addRow(['Report Type', capitalizeReportType(data.type)]);
    summarySheet.addRow(['Generated', format(new Date(), 'MMMM dd, yyyy HH:mm:ss')]);
    
    if (data.dateRange) {
      summarySheet.addRow([
        'Period',
        `${format(data.dateRange.start, 'MMM dd, yyyy')} - ${format(data.dateRange.end, 'MMM dd, yyyy')}`,
      ]);
    }

    summarySheet.addRow([]);
    
    // Executive Summary header
    summarySheet.addRow(['EXECUTIVE SUMMARY']);
    summarySheet.getRow(summarySheet.rowCount).font = { bold: true, size: 12 };
    
    // Metrics
    summarySheet.addRow(['Total Campaigns', data.summary.totalCampaigns]);
    summarySheet.addRow(['Total Emails Sent', data.summary.totalEmailsSent]);
    summarySheet.addRow(['Success Rate', `${data.summary.successRate}%`]);
    summarySheet.addRow(['At-Risk Users', data.summary.atRiskUsers]);

    // Column widths
    summarySheet.getColumn(1).width = 20;
    summarySheet.getColumn(2).width = 40;
  }

  // Campaigns Sheet
  if (data.campaigns && data.campaigns.length > 0) {
    const campaignSheet = workbook.addWorksheet('Campaigns');
    
    // Header row
    const headerRow = campaignSheet.addRow(['Campaign Name', 'Status', 'Created Date', 'Scheduled Date', 'Target Count']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF8C00' } // Orange
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Data rows
    data.campaigns.forEach((campaign) => {
      campaignSheet.addRow([
        campaign.name || 'Unknown',
        campaign.status || 'Unknown',
        campaign.createdAt
          ? format(new Date(campaign.createdAt), 'MMM dd, yyyy HH:mm')
          : 'N/A',
        campaign.scheduledAt
          ? format(new Date(campaign.scheduledAt), 'MMM dd, yyyy HH:mm')
          : 'Not Scheduled',
        campaign.targetCount || 0,
      ]);
    });

    // Column widths
    campaignSheet.getColumn(1).width = 30;
    campaignSheet.getColumn(2).width = 15;
    campaignSheet.getColumn(3).width = 20;
    campaignSheet.getColumn(4).width = 20;
    campaignSheet.getColumn(5).width = 15;
  }

  // Users Sheet
  if (data.users && data.users.length > 0) {
    const userSheet = workbook.addWorksheet('Users');
    
    // Header row
    const headerRow = userSheet.addRow(['Name', 'Email', 'Role', 'Department', 'Created Date']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF8C00' } // Orange
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Data rows
    data.users.forEach((user) => {
      userSheet.addRow([
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        user.email || 'N/A',
        user.role || 'User',
        user.department || 'N/A',
        user.createdAt
          ? format(new Date(user.createdAt), 'MMM dd, yyyy HH:mm')
          : 'N/A',
      ]);
    });

    // Column widths
    userSheet.getColumn(1).width = 25;
    userSheet.getColumn(2).width = 30;
    userSheet.getColumn(3).width = 15;
    userSheet.getColumn(4).width = 20;
    userSheet.getColumn(5).width = 20;
  }

  // Results/Activity Sheet
  if (data.results && data.results.length > 0) {
    const resultsSheet = workbook.addWorksheet('Activity Results');
    
    // Header row
    const headerRow = resultsSheet.addRow(['Target', 'Campaign', 'Opened', 'Clicked', 'Submitted', 'Date']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF8C00' } // Orange
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Data rows
    data.results.forEach((result: any) => {
      const resultData = result.campaign_results || result;
      const campaignData = result.campaigns;
      
      resultsSheet.addRow([
        resultData.targetId?.toString() || 'N/A',
        campaignData?.name || 'Unknown Campaign',
        resultData.opened ? 'Yes' : 'No',
        resultData.clicked ? 'Yes' : 'No',
        resultData.submitted ? 'Yes' : 'No',
        resultData.createdAt
          ? format(new Date(resultData.createdAt), 'MMM dd, yyyy HH:mm')
          : 'N/A',
      ]);
    });

    // Column widths
    resultsSheet.getColumn(1).width = 15;
    resultsSheet.getColumn(2).width = 30;
    resultsSheet.getColumn(3).width = 10;
    resultsSheet.getColumn(4).width = 10;
    resultsSheet.getColumn(5).width = 12;
    resultsSheet.getColumn(6).width = 20;
  }

  // Write file
  await workbook.xlsx.writeFile(filepath);
}

// ============================================
// JSON EXPORT - Structured Data
// ============================================
async function exportToJSON(data: ReportData, filepath: string) {
  const jsonData = {
    metadata: {
      reportType: data.type,
      organizationName: data.organizationName || 'Unknown',
      generatedAt: new Date().toISOString(),
      dateRange: data.dateRange
        ? {
            start: data.dateRange.start.toISOString(),
            end: data.dateRange.end.toISOString(),
          }
        : null,
    },
    summary: data.summary || null,
    campaigns: data.campaigns || [],
    users: data.users || [],
    results: data.results || [],
    chartData: data.chartData || null,
  };

  await fs.promises.writeFile(filepath, JSON.stringify(jsonData, null, 2), 'utf-8');
}

// ============================================
// CSV EXPORT - Legacy Support
// ============================================
async function exportToCSV(data: ReportData, filepath: string) {
  // Simple CSV implementation for backward compatibility
  let csvContent = '';

  if (data.campaigns && data.campaigns.length > 0) {
    csvContent += 'Campaign Name,Status,Created Date,Scheduled Date\n';
    data.campaigns.forEach((campaign) => {
      csvContent += `"${campaign.name || 'Unknown'}","${campaign.status || 'Unknown'}","${
        campaign.createdAt
          ? format(new Date(campaign.createdAt), 'yyyy-MM-dd HH:mm:ss')
          : 'N/A'
      }","${
        campaign.scheduledAt
          ? format(new Date(campaign.scheduledAt), 'yyyy-MM-dd HH:mm:ss')
          : 'Not Scheduled'
      }"\n`;
    });
  } else if (data.users && data.users.length > 0) {
    csvContent += 'Name,Email,Role,Created Date\n';
    data.users.forEach((user) => {
      csvContent += `"${
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'
      }","${user.email || 'N/A'}","${user.role || 'User'}","${
        user.createdAt
          ? format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm:ss')
          : 'N/A'
      }"\n`;
    });
  }

  await fs.promises.writeFile(filepath, csvContent, 'utf-8');
}

// ============================================
// Helper Functions
// ============================================
function capitalizeReportType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
