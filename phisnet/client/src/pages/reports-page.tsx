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
  Activity,
  Mail,
  TrendingUp,
  Users,
  FileSpreadsheet,
  FileText,
  FileJson,
  Edit,
  Trash2,
  Plus
} from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  LineChart,
  Line,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function ScheduledReportsManager() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [formData, setFormData] = useState({
    type: 'executive',
    cadence: 'weekly',
    timeOfDay: '09:00',
    recipients: '',
    enabled: true
  });

  // Fetch schedules
  const { data: schedules, refetch } = useQuery({
    queryKey: ['/api/report-schedules'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/report-schedules');
      return res.json();
    }
  });

  // Create schedule mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/report-schedules', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule created successfully" });
      setIsCreateDialogOpen(false);
      setFormData({ type: 'executive', cadence: 'weekly', timeOfDay: '09:00', recipients: '', enabled: true });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to create schedule", variant: "destructive" });
    }
  });

  // Update schedule mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/report-schedules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule updated successfully" });
      setIsEditDialogOpen(false);
      setEditingSchedule(null);
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to update schedule", variant: "destructive" });
    }
  });

  // Delete schedule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/report-schedules/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule deleted successfully" });
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to delete schedule", variant: "destructive" });
    }
  });

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      type: schedule.type,
      cadence: schedule.cadence,
      timeOfDay: schedule.timeOfDay,
      recipients: schedule.recipients,
      enabled: schedule.enabled
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, data: formData });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleEnabled = (schedule: any) => {
    updateMutation.mutate({
      id: schedule.id,
      data: { ...schedule, enabled: !schedule.enabled }
    });
  };

  const reportTypeLabels: Record<string, string> = {
    executive: 'Executive Summary',
    detailed: 'Detailed Analysis',
    compliance: 'Compliance Report'
  };

  const cadenceLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly'
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Reports</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Automate report generation and delivery via email
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedules && schedules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule: any) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {reportTypeLabels[schedule.type] || schedule.type}
                    </TableCell>
                    <TableCell>{cadenceLabels[schedule.cadence] || schedule.cadence}</TableCell>
                    <TableCell>{schedule.timeOfDay}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={schedule.recipients}>
                        {schedule.recipients}
                      </div>
                    </TableCell>
                    <TableCell>
                      {schedule.lastRunAt 
                        ? format(new Date(schedule.lastRunAt), 'MMM d, yyyy HH:mm')
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {schedule.nextRunAt 
                        ? format(new Date(schedule.nextRunAt), 'MMM d, yyyy HH:mm')
                        : 'Not scheduled'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={() => toggleEnabled(schedule)}
                        />
                        <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                          {schedule.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(schedule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {schedules ? 'No scheduled reports yet. Create one to get started.' : 'Loading schedules...'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Scheduled Report</DialogTitle>
            <DialogDescription>
              Configure a new automated report delivery schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Report Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive Summary</SelectItem>
                  <SelectItem value="detailed">Detailed Analysis</SelectItem>
                  <SelectItem value="compliance">Compliance Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cadence">Frequency</Label>
              <Select
                value={formData.cadence}
                onValueChange={(value) => setFormData({ ...formData, cadence: value })}
              >
                <SelectTrigger id="cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeOfDay">Time of Day (HH:mm)</Label>
              <Input
                id="timeOfDay"
                type="time"
                value={formData.timeOfDay}
                onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="recipients"
                type="text"
                placeholder="email1@example.com, email2@example.com"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enable immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Scheduled Report</DialogTitle>
            <DialogDescription>
              Update the automated report delivery schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type">Report Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive Summary</SelectItem>
                  <SelectItem value="detailed">Detailed Analysis</SelectItem>
                  <SelectItem value="compliance">Compliance Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cadence">Frequency</Label>
              <Select
                value={formData.cadence}
                onValueChange={(value) => setFormData({ ...formData, cadence: value })}
              >
                <SelectTrigger id="edit-cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-timeOfDay">Time of Day (HH:mm)</Label>
              <Input
                id="edit-timeOfDay"
                type="time"
                value={formData.timeOfDay}
                onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="edit-recipients"
                type="text"
                placeholder="email1@example.com, email2@example.com"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="edit-enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
          <TabsTrigger value="scheduled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Scheduled Reports
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

        <TabsContent value="scheduled" className="space-y-6">
          <ScheduledReportsManager />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
