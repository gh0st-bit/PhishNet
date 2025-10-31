/**
 * React Hook for PDF Report Generation
 * Provides easy-to-use report generation functionality for React components
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadPDFReport, ReportData, ReportOptions } from './pdf-generator';
import { useToast } from '@/hooks/use-toast';

interface UseReportGeneratorReturn {
  generateReport: (options?: ReportOptions) => Promise<void>;
  isGenerating: boolean;
  error: Error | null;
}

/**
 * Hook to generate and download PDF reports
 */
export function useReportGenerator(): UseReportGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const generateReport = async (options: ReportOptions = { type: 'executive' }) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Fetch report data from API
      const response = await fetch('/api/reports/data');
      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }

      const reportData: ReportData = await response.json();

      // Generate and download PDF
      const filename = `PhishNet-${options.type}-Report-${new Date().toISOString().split('T')[0]}.pdf`;
      await downloadPDFReport(reportData, options, filename);

      toast({
        title: 'Report Generated',
        description: `Your ${options.type} report has been downloaded successfully.`,
      });
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Report Generation Failed',
        description: error.message || 'An error occurred while generating the report.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateReport,
    isGenerating,
    error,
  };
}

/**
 * Hook to fetch report data preview
 */
export function useReportData() {
  return useQuery({
    queryKey: ['/api/reports/data'],
    queryFn: async () => {
      const response = await fetch('/api/reports/data');
      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }
      return response.json() as Promise<ReportData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
