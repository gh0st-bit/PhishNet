import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Table Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// UI Components and Utilities
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import type { Campaign } from "@shared/types/api";
import { getBadgeVariant, safeToString } from "@/lib/utils";

// Component Props
interface RecentCampaignsProps {
  campaigns?: Campaign[];
  isLoading?: boolean;
}

// RecentCampaigns Component
export default function RecentCampaigns({ campaigns, isLoading }: RecentCampaignsProps) {
  const [, navigate] = useLocation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-5 px-6">
        <CardTitle>Recent Campaigns</CardTitle>
        <Button 
          variant="link" 
          className="text-xs" 
          onClick={() => navigate("/campaigns")}
        >
          View All
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Open Rate</TableHead>
                <TableHead>Click Rate</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading campaigns...
                  </TableCell>
                </TableRow>
              ) : campaigns && campaigns.length > 0 ? (
                campaigns.slice(0, 5).map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{safeToString(campaign.name)}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(safeToString(campaign.status))}>
                        {safeToString(campaign.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.targets ? `${Math.round((campaign.opened / campaign.targets) * 100)}%` : "-"}</TableCell>
                    <TableCell>{campaign.targets ? `${Math.round((campaign.clicked / campaign.targets) * 100)}%` : "-"}</TableCell>
                    <TableCell>
                      {campaign.created_at ? formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true }) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No campaigns found. Create your first campaign.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
