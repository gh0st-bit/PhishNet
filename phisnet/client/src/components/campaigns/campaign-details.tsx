import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { 
  CalendarClock, 
  CheckCircle2, 
  Clock, 
  Download, 
  Filter, 
  Mail, 
  MousePointerClick, 
  Pencil, 
  Send, 
  ServerCrash, 
  UserRound,
  X
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format, formatDistance, formatDistanceToNow, differenceInHours, differenceInDays, differenceInMinutes } from "date-fns";
import { useCampaignDetails, useCampaignResults } from "@/hooks/useApi";
import { getBadgeVariant, safeToString, getDisplayStatus } from "@/lib/utils";
import type { Campaign, CampaignResult } from "@shared/types/api";

interface CampaignDetailsProps {
  campaignId: number;
  onEdit: () => void;
}

interface FilterState {
  sent: boolean | null;
  opened: boolean | null;
  clicked: boolean | null;
  submitted: boolean | null;
}

export default function CampaignDetails({ campaignId, onEdit }: CampaignDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState<FilterState>({
    sent: null,
    opened: null,
    clicked: null,
    submitted: null,
  });

  const { data: campaign, isLoading } = useCampaignDetails(campaignId);
  const { data: results = [] } = useCampaignResults(campaignId);

  // Filter results based on selected filters
  const filteredResults = results.filter((result) => {
    if (filters.sent !== null && result.sent !== filters.sent) return false;
    if (filters.opened !== null && result.opened !== filters.opened) return false;
    if (filters.clicked !== null && result.clicked !== filters.clicked) return false;
    if (filters.submitted !== null && result.submitted !== filters.submitted) return false;
    return true;
  });

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some((f) => f !== null);

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      sent: null,
      opened: null,
      clicked: null,
      submitted: null,
    });
  };

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ["Target", "Sent", "Opened", "Clicked", "Data Submitted", "Timestamp"],
      ...filteredResults.map((result) => [
        `Target #${result.targetId}`,
        result.sent ? "Yes" : "No",
        result.opened ? "Yes" : "No",
        result.clicked ? "Yes" : "No",
        result.submitted ? "Yes" : "No",
        result.timestamp ? format(new Date(result.timestamp), "MMM d, yyyy h:mm a") : "-",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `campaign-results-${campaignId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading || !campaign) {
    return <div className="flex justify-center p-12">Loading campaign details...</div>;
  }

  // Calculate stats - using type-safe array operations
  const typedResults = results as CampaignResult[];
  const totalTargets = typedResults.length;
  const sentCount = typedResults.filter((r: CampaignResult) => r.sent).length;
  const openedCount = typedResults.filter((r: CampaignResult) => r.opened).length;
  const clickedCount = typedResults.filter((r: CampaignResult) => r.clicked).length;
  const submittedCount = typedResults.filter((r: CampaignResult) => r.submitted).length;
  
  const sentPercentage = totalTargets > 0 ? Math.round((sentCount / totalTargets) * 100) : 0;
  const openedPercentage = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
  const clickedPercentage = openedCount > 0 ? Math.round((clickedCount / openedCount) * 100) : 0;
  const submittedPercentage = clickedCount > 0 ? Math.round((submittedCount / clickedCount) * 100) : 0;

  // Calculate campaign duration
  let campaignDuration = 'Duration not specified';
  if (campaign.scheduledAt && campaign.endDate) {
    const startDate = new Date(campaign.scheduledAt);
    const endDate = new Date(campaign.endDate);
    const days = differenceInDays(endDate, startDate);
    const hours = differenceInHours(endDate, startDate) % 24;
    const minutes = differenceInMinutes(endDate, startDate) % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    campaignDuration = parts.length > 0 ? parts.join(' ') : 'Less than a minute';
  }

  // Get display status based on schedule timing
  const displayStatus = getDisplayStatus(campaign);

  const statusBadgeVariant = {
    "active": "success",
    "draft": "outline", 
    "completed": "secondary",
    "scheduled": "default",
    "paused": "warning"
  }[displayStatus] || "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusBadgeVariant as any}>
              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {campaign.createdAt ? format(new Date(campaign.createdAt), "MMM dd, yyyy 'at' HH:mm") : 'Unknown'}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <div className="flex items-center gap-2 mt-1">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <span>{campaignDuration}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Targets</p>
                <p className="text-2xl font-semibold mt-1">{totalTargets}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-semibold mt-1">{sentCount}</p>
              </div>
              <div>
                <UserRound className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-semibold mt-1">{openedPercentage}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Click Rate</p>
                <p className="text-2xl font-semibold mt-1">{clickedPercentage}%</p>
              </div>
              <MousePointerClick className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="tabs-list">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="details">Campaign Details</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Progress</CardTitle>
              <CardDescription>Summary of your campaign performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" />
                      <span>Sent</span>
                    </div>
                    <span>{sentCount} of {totalTargets} ({sentPercentage}%)</span>
                  </div>
                  <Progress value={sentPercentage} className="h-2" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-info" />
                      <span>Opened</span>
                    </div>
                    <span>{openedCount} of {sentCount} ({openedPercentage}%)</span>
                  </div>
                  <Progress value={openedPercentage} className="h-2" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4 text-warning" />
                      <span>Clicked</span>
                    </div>
                    <span>{clickedCount} of {openedCount} ({clickedPercentage}%)</span>
                  </div>
                  <Progress value={clickedPercentage} className="h-2" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>Data Submitted</span>
                    </div>
                    <span>{submittedCount} of {clickedCount} ({submittedPercentage}%)</span>
                  </div>
                  <Progress value={submittedPercentage} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="results">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Campaign Results</CardTitle>
                <CardDescription>Detailed results for each target</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" asChild>
                    <div>
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                      {hasActiveFilters && (
                        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                          {Object.values(filters).filter((f) => f !== null).length}
                        </span>
                      )}
                    </div>
                  </Button>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Filter Results</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={filters.sent === true}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters((prev) => ({ ...prev, sent: true }));
                        } else {
                          setFilters((prev) => ({ ...prev, sent: null }));
                        }
                      }}
                    >
                      Sent ✓
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={filters.sent === false}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters((prev) => ({ ...prev, sent: false }));
                        } else {
                          setFilters((prev) => ({ ...prev, sent: null }));
                        }
                      }}
                    >
                      Not Sent ✗
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={filters.opened === true}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters((prev) => ({ ...prev, opened: true }));
                        } else {
                          setFilters((prev) => ({ ...prev, opened: null }));
                        }
                      }}
                    >
                      Opened ✓
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={filters.clicked === true}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters((prev) => ({ ...prev, clicked: true }));
                        } else {
                          setFilters((prev) => ({ ...prev, clicked: null }));
                        }
                      }}
                    >
                      Clicked ✓
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={filters.submitted === true}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters((prev) => ({ ...prev, submitted: true }));
                        } else {
                          setFilters((prev) => ({ ...prev, submitted: null }));
                        }
                      }}
                    >
                      Data Submitted ✓
                    </DropdownMenuCheckboxItem>
                    {hasActiveFilters && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleResetFilters} className="text-muted-foreground">
                          <X className="h-4 w-4 mr-2" />
                          Clear Filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredResults.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hasActiveFilters && (
                <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredResults.length} of {results.length} results
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-6"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Data Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length > 0 ? (
                    filteredResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">Target #{result.targetId}</TableCell>
                        <TableCell>
                          {result.sent ? 
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              {result.timestamp && format(new Date(result.timestamp), "MMM d, h:mm a")}
                            </span> : 
                            <ServerCrash className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          {result.opened ? 
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              {result.timestamp && format(new Date(result.timestamp), "MMM d, h:mm a")}
                            </span> : 
                            "-"}
                        </TableCell>
                        <TableCell>
                          {result.clicked ? 
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              {result.timestamp && format(new Date(result.timestamp), "MMM d, h:mm a")}
                            </span> : 
                            "-"}
                        </TableCell>
                        <TableCell>
                          {result.submitted ? 
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              {result.timestamp && format(new Date(result.timestamp), "MMM d, h:mm a")}
                            </span> : 
                            "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        {hasActiveFilters ? "No results match the selected filters." : "No results data available yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Configuration</CardTitle>
              <CardDescription>Details about this campaign's setup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Target Group</h3>
                  <p className="mt-1">{campaign.targetGroup || "Unknown Group"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Total Targets</h3>
                  <p className="mt-1">{campaign.totalTargets || 0}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Email Template</h3>
                  <p className="mt-1">{campaign.emailTemplate?.name || "Unknown Template"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Landing Page</h3>
                  <p className="mt-1">{campaign.landingPage?.name || "Unknown Page"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">SMTP Profile</h3>
                  <p className="mt-1">{campaign.smtpProfile?.name || "Unknown Profile"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                  <p className="mt-1">{campaign.createdBy || "System"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Scheduled Start</h3>
                  <p className="mt-1">
                    {campaign.scheduledAt ? 
                      format(new Date(campaign.scheduledAt), "MMM d, yyyy 'at' h:mm a") : 
                      "Not scheduled"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">End Date</h3>
                  <p className="mt-1">
                    {campaign.endDate ? 
                      format(new Date(campaign.endDate), "MMM d, yyyy 'at' h:mm a") : 
                      "No end date specified"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}