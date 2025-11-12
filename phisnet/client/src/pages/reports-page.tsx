import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Download, 
  FileDown, 
  Calendar, 
  Filter,
  Activity,
  Mail,
  TrendingUp,
  Users,
  FileSpreadsheet,
  FileText,
  FileJson
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function ReportsPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isDark = theme === "dark";

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -365),
    to: new Date(),
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [exportFormat, setExportFormat] = useState<string>("pdf");

  // Fetch real report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["/api/reports/data", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("startDate", dateRange.from.toISOString());
      if (dateRange?.to) params.append("endDate", dateRange.to.toISOString());

      const response = await apiRequest("GET", `/api/reports/data?${params}`);
      return await response.json();
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({ exportType, format }: { exportType: string; format: string }) => {
      const response = await apiRequest("POST", "/api/reports/export", {
        type: exportType,
        format: format,
        theme: theme, // Pass current theme to server
        dateRange: dateRange
          ? {
              start: dateRange.from?.toISOString(),
              end: dateRange.to?.toISOString(),
            }
          : null,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const formatLabels: Record<string, string> = {
        pdf: 'PDF',
        xlsx: 'Excel',
        json: 'JSON',
        csv: 'CSV'
      };
      
      toast({
        title: "Export successful",
        description: `Your ${formatLabels[data.format] || data.format.toUpperCase()} report has been generated successfully.`,
      });

      // Download the file
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = (type: string) => {
    exportMutation.mutate({ exportType: type, format: exportFormat });
  };

  // Colors for charts
  const colors = {
    text: isDark ? "#C9D1D9" : "#24292F",
    muted: isDark ? "#8B949E" : "#6E7781",
    grid: isDark ? "#30363D" : "#EAEEF2",
    line: isDark ? "#58A6FF" : "#0969DA",
    chartColors: ["#58A6FF", "#39D353", "#F0883E", "#FF7B72", "#8B949E"],
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <div className="flex items-center gap-4">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
            className="w-[300px]"
          />
          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>PDF Document</span>
                </div>
              </SelectItem>
              <SelectItem value="xlsx">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Excel (.xlsx)</span>
                </div>
              </SelectItem>
              <SelectItem value="json">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" />
                  <span>JSON Data</span>
                </div>
              </SelectItem>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" />
                  <span>CSV File</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => handleExport("comprehensive")}
            disabled={exportMutation.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportMutation.isPending ? 'Exporting...' : 'Export All'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-background border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Overview
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Campaign Reports
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            User Performance
          </TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Campaigns
                      </p>
                      <p className="text-2xl font-bold">
                        {reportData?.summary?.totalCampaigns || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Emails Sent
                      </p>
                      <p className="text-2xl font-bold">
                        {reportData?.summary?.totalEmailsSent || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-full">
                      <Mail className="h-4 w-4 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Success Rate
                      </p>
                      <p className="text-2xl font-bold">
                        {reportData?.summary?.successRate || 0}%
                      </p>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-full">
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        At Risk Users
                      </p>
                      <p className="text-2xl font-bold">
                        {reportData?.summary?.atRiskUsers || 0}
                      </p>
                    </div>
                    <div className="p-2 bg-yellow-500/10 rounded-full">
                      <Users className="h-4 w-4 text-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Campaign Performance Over Time</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("campaigns")}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData?.chartData?.monthly || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                        <XAxis dataKey="name" stroke={colors.text} />
                        <YAxis stroke={colors.text} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#161B22" : "#FFF",
                            borderColor: colors.grid,
                            color: colors.text,
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="sent"
                          stroke={colors.line}
                          name="Sent"
                        />
                        <Line
                          type="monotone"
                          dataKey="opened"
                          stroke={colors.chartColors[1]}
                          name="Opened"
                        />
                        <Line
                          type="monotone"
                          dataKey="clicked"
                          stroke={colors.chartColors[2]}
                          name="Clicked"
                        />
                        <Line
                          type="monotone"
                          dataKey="submitted"
                          stroke={colors.chartColors[3]}
                          name="Submitted"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Campaign Types Distribution</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("results")}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData?.chartData?.campaignTypes || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {(reportData?.chartData?.campaignTypes || []).map(
                            (entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  colors.chartColors[
                                    index % colors.chartColors.length
                                  ]
                                }
                              />
                            )
                          )}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#161B22" : "#FFF",
                            borderColor: colors.grid,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Campaign Reports</CardTitle>
              <Button
                variant="outline"
                onClick={() => handleExport("campaigns")}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Campaigns
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.campaigns?.map((campaign: any) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            campaign.status === "Completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{campaign.sentCount}</TableCell>
                      <TableCell>{campaign.openedCount}</TableCell>
                      <TableCell>{campaign.clickedCount}</TableCell>
                      <TableCell>{campaign.successRate}%</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation('/campaigns')}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No campaign data available for the selected date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Performance</CardTitle>
              <Button
                variant="outline"
                onClick={() => handleExport("users")}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Users
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Success Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.users?.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.riskLevel === "High Risk"
                              ? "destructive"
                              : user.riskLevel === "Medium Risk"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {user.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.totalCampaigns}</TableCell>
                      <TableCell>{user.clickedCount}</TableCell>
                      <TableCell>{user.submittedCount}</TableCell>
                      <TableCell>{user.successRate}%</TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No user data available for the selected date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData?.trendData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="month" stroke={colors.text} />
                    <YAxis stroke={colors.text} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? "#161B22" : "#FFF",
                        borderColor: colors.grid,
                        color: colors.text,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke={colors.line}
                      name="Success Rate %"
                    />
                    <Line
                      type="monotone"
                      dataKey="awareness"
                      stroke={colors.chartColors[1]}
                      name="Awareness Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
