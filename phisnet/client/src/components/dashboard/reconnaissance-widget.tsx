// UI components from your design system
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// React Query for data fetching/caching
import { useQuery } from "@tanstack/react-query";

// Icons from lucide-react
import { Search, Globe, Users, Bot, Eye, ArrowRight } from "lucide-react";

// Client-side navigation
import { Link } from "wouter";

// Define the expected structure of the reconnaissance statistics
interface ReconStats {
  activeCampaigns: number;
  totalContacts: number;
  aiProfiles: number;
  recentActivity: string;
}

export function ReconnaissanceWidget() {
  // Fetch reconnaissance statistics — currently using mock data
  // Mock data - in real app this would fetch from API
  const { data: reconStats } = useQuery({
    queryKey: ['reconnaissance-stats'], // Unique key for caching
    queryFn: async (): Promise<ReconStats> => {
      // This would be a real API call
      // Simulated API response — replace with actual backend call
      return {
        activeCampaigns: 3,
        totalContacts: 127,
        aiProfiles: 45,
        recentActivity: "2 hours ago"
      };
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes // Keep data fresh
    refetchOnWindowFocus: false // Don't refetch on window focus / Prevent auto-refresh when switching tabs/windows
  });

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-600" />
          Reconnaissance
        </CardTitle>
        <Badge variant="secondary" className="text-xs">
          AI-Powered
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {reconStats?.activeCampaigns || 0}
              </div>
              <div className="text-xs text-muted-foreground">Active Jobs</div>
            </div>
            
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {reconStats?.totalContacts || 0}
              </div>
              <div className="text-xs text-muted-foreground">Contacts Found</div>
            </div>
            
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {reconStats?.aiProfiles || 0}
              </div>
              <div className="text-xs text-muted-foreground">AI Profiles</div>
            </div>
            
            <div className="text-center p-2 bg-orange-50 rounded-lg">
              <div className="text-lg font-bold text-orange-600">98%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-3 w-3 text-blue-500" />
              <span className="text-muted-foreground">Domain Discovery</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">Contact Enumeration</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Bot className="h-3 w-3 text-purple-500" />
              <span className="text-muted-foreground">AI Profile Generation</span>
            </div>
          </div>

          {/* Last Activity */}
          {reconStats?.recentActivity && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              Last activity: {reconStats.recentActivity}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Link href="/reconnaissance">
              <Button size="sm" className="flex-1 text-xs">
                <Search className="h-3 w-3 mr-1" />
                Start Recon
              </Button>
            </Link>
            <Link href="/reconnaissance?tab=results">
              <Button variant="outline" size="sm" className="flex-1 text-xs">
                <Eye className="h-3 w-3 mr-1" />
                View Results
              </Button>
            </Link>
          </div>

          {/* Quick Start Help */}
          <div className="bg-gray-50 p-3 rounded-lg text-xs">
            <div className="font-medium text-foreground mb-1">Quick Start:</div>
            <div className="text-muted-foreground space-y-1">
              <div>1. Select a campaign</div>
              <div>2. Enter target domains</div>
              <div>3. Let AI do the rest</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReconnaissanceWidget;