import AppLayout from "@/components/layout/app-layout";
import StatCard from "@/components/dashboard/stat-card";
import RecentCampaigns from "@/components/dashboard/recent-campaigns";
import PhishingMetricsChart from "@/components/dashboard/phishing-metrics-chart";
import ThreatLandscape from "@/components/dashboard/threat-landscape";
import AtRiskUsers from "@/components/dashboard/at-risk-users";
import SecurityTraining from "@/components/dashboard/security-training";
import { useAuth } from "@/hooks/use-auth";
import { 
  useDashboardStats, 
  useCampaigns,
  useNotifications
} from "@/hooks/useApi";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  ChartLine, 
  Users, 
  GraduationCap,
  Bell, 
  AlertTriangle, 
  Info, 
  CheckCircle 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/types/api";

function RecentNotifications() {
  const { data: notifications = [], isLoading } = useNotifications();

  const getIconForType = (type: string, priority?: string) => {
    if (priority === 'urgent' || priority === 'high') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    
    switch (type) {
      case 'campaign': return <Bell className="h-4 w-4 text-blue-500" />;
      case 'security': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'system': return <Info className="h-4 w-4 text-gray-500" />;
      case 'training': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading notifications...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Recent Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!notifications || !Array.isArray(notifications) || notifications.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent notifications
          </p>
        ) : (
          <div className="space-y-3">
            {(Array.isArray(notifications) ? notifications : []).slice(0, 5).map((notification: Notification) => (
              <div key={notification.id} className="flex items-start gap-3">
                {getIconForType(notification.type, notification.priority)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-3">
              View All Notifications
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  
  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats();
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  
  // Fetch threat intelligence data
  const { data: threatData, isLoading: threatLoading } = useQuery({
    queryKey: ['dashboard-threat-intel'],
    queryFn: async () => {
      const response = await fetch('/api/threat-intelligence/analysis');
      if (!response.ok) throw new Error('Failed to fetch threat data');
      return response.json();
    },
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });

  return (
    <AppLayout>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Active Campaigns"
          value={dashboardStats?.activeCampaigns || 0}
          change={dashboardStats?.campaignChange || 0}
          icon={<Activity />}
          iconBgColor="bg-blue-900/30"
          iconColor="text-primary"
        />
        <StatCard 
          title="Phishing Success Rate"
          value={`${dashboardStats?.successRate || 0}%`}
          change={dashboardStats?.successRateChange || 0}
          icon={<ChartLine />}
          iconBgColor="bg-red-900/30"
          iconColor="text-destructive"
          negative
        />
        <StatCard 
          title="Total Users"
          value={dashboardStats?.totalUsers || 0}
          change={dashboardStats?.newUsers || 0}
          suffix="new this week"
          icon={<Users />}
          iconBgColor="bg-green-900/30"
          iconColor="text-success"
        />
        <StatCard 
          title="Training Completion"
          value={`${dashboardStats?.trainingCompletion || 0}%`}
          change={dashboardStats?.trainingCompletionChange || 0}
          icon={<GraduationCap />}
          iconBgColor="bg-yellow-900/30"
          iconColor="text-warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <RecentCampaigns 
            campaigns={campaigns || []} 
            isLoading={campaignsLoading}
          />
        </div>
        <PhishingMetricsChart data={dashboardStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ThreatLandscape threats={threatData?.recentThreats || []} threatAnalysis={threatData} />
        <AtRiskUsers users={[]} />
        <SecurityTraining trainings={[]} />
      </div>

      <div className="mt-6">
        <RecentNotifications />
      </div>
    </AppLayout>
  );
}
