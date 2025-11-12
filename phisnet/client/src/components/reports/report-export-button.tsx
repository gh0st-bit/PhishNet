/**
 * Report Export Button Component
 * Provides UI for generating and downloading PDF reports
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useReportGenerator } from '@/lib/reports/use-report-generator';
import { ReportOptions } from '@/lib/reports/pdf-generator';

export function ReportExportButton() {
  const { generateReport, isGenerating } = useReportGenerator();

  const handleGenerateReport = async (type: ReportOptions['type']) => {
    await generateReport({
      type,
      includeCampaignDetails: type !== 'executive',
      includeRiskyUsers: type === 'detailed' || type === 'compliance',
      includeCharts: false, // Charts can be added in future enhancement
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Export Report
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Report Type</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleGenerateReport('executive')}
          disabled={isGenerating}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">Executive Summary</span>
            <span className="text-xs text-muted-foreground">
              High-level overview with key metrics
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleGenerateReport('detailed')}
          disabled={isGenerating}
          className="cursor-pointer"
        >
          <Download className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">Detailed Report</span>
            <span className="text-xs text-muted-foreground">
              Complete analysis with campaign details
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleGenerateReport('compliance')}
          disabled={isGenerating}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">Compliance Report</span>
            <span className="text-xs text-muted-foreground">
              Audit-ready documentation
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
