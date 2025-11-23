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
  UserRound 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format, formatDistance, formatDistanceToNow } from "date-fns";
import { useCampaignDetails, useCampaignResults } from "@/hooks/useApi";
import { getBadgeVariant, safeToString } from "@/lib/utils";
import type { Campaign, CampaignResult } from "@shared/types/api";
// Define the props for CampaignDetails component
interface CampaignDetailsProps {
  campaignId: number;
  onEdit: () => void;
}
// CampaignDetails component to display detailed information about a campaign
export default function CampaignDetails({ campaignId, onEdit }: CampaignDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");
// Fetch campaign details and results using custom hooks
  const { data: campaign, isLoading } = useCampaignDetails(campaignId);
  const { data: results = [] } = useCampaignResults(campaignId);
// Show loading state if data is still being fetched
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
  // Calculate percentages safely
  const sentPercentage = totalTargets > 0 ? Math.round((sentCount / totalTargets) * 100) : 0;
  const openedPercentage = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
  const clickedPercentage = openedCount > 0 ? Math.round((clickedCount / openedCount) * 100) : 0;
  const submittedPercentage = clickedCount > 0 ? Math.round((submittedCount / clickedCount) * 100) : 0;
  // Calculate campaign duration
  const campaignStartTime = campaign.created_at ? new Date(campaign.created_at) : new Date();
  const campaignEndTime = null; // endDate not available in basic Campaign type
  const campaignDuration = 'Duration not specified';
  // Determine badge variant based on campaign status
  const statusBadgeVariant = {
    "active": "success",
    "draft": "outline", 
    "completed": "secondary",
    "paused": "warning"
  }[campaign.status] || "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusBadgeVariant as any}>
              {campaign.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
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
                  <span className="font-semibold">{campaign.status}</span>
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
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                  {results.length > 0 ? (
                    results.map((result) => (
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
                        No results data available yet.
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