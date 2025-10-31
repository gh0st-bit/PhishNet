import AppLayout from "@/components/layout/app-layout";
import StatCard from "@/components/dashboard/stat-card";
import RecentCampaigns from "@/components/dashboard/recent-campaigns";
import PhishingMetricsChart from "@/components/dashboard/phishing-metrics-chart";
import ThreatLandscape from "@/components/dashboard/threat-landscape";
import AtRiskUsers from "@/components/dashboard/at-risk-users";
import SecurityTraining from "@/components/dashboard/security-training";
import { ReportExportButton } from "@/components/reports/report-export-button";
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
  // auth is available if needed later
  useAuth();
  
  const { data: dashboardStats } = useDashboardStats();
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  // Real metrics for chart
  const { data: phishingMetrics } = useQuery({
    queryKey: ["/api/dashboard/phishing-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/phishing-metrics");
      if (!res.ok) throw new Error("Failed to fetch phishing metrics");
      return res.json();
    },
    refetchInterval: 10 * 60 * 1000,
  });
  // Real at-risk users
  const { data: riskUsersRaw } = useQuery({
    queryKey: ["/api/dashboard/risk-users"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/risk-users");
      if (!res.ok) throw new Error("Failed to fetch risk users");
      return res.json();
    },
    refetchInterval: 10 * 60 * 1000,
  });
  // Trainings (placeholder endpoint until real training module exists)
  const { data: trainings } = useQuery({
    queryKey: ["/api/dashboard/trainings"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/trainings");
      if (!res.ok) throw new Error("Failed to fetch trainings");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });
  
  // Fetch threat intelligence data
  const { data: threatData } = useQuery({
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your phishing awareness campaigns
          </p>
        </div>
        <ReportExportButton />
      </div>
      
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
        <PhishingMetricsChart 
          data={(phishingMetrics || []).map((m: any) => {
            const hasRate = typeof m.rate === 'number';
            let fallbackRate = 0;
            if (!hasRate) {
              const sent = Number(m.sent || 0);
              const clicked = Number(m.clicked || 0);
              fallbackRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
            }
            return {
              date: m.date,
              rate: hasRate ? m.rate : fallbackRate,
            };
          })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ThreatLandscape threats={threatData?.recentThreats || []} threatAnalysis={threatData} />
        <AtRiskUsers 
          users={(riskUsersRaw || []).map((u: any) => {
            // Derive risk level if not provided
            let derivedRisk: 'High Risk' | 'Medium Risk' | 'Low Risk' = 'Low Risk';
            if (typeof u?.riskScore === 'number') {
              if (u.riskScore >= 3) derivedRisk = 'High Risk';
              else if (u.riskScore >= 2) derivedRisk = 'Medium Risk';
            }
            return {
              id: u.id,
              name: u.name,
              department: u.department || 'Unknown',
              riskLevel: u.riskLevel || derivedRisk,
            };
          })}
        />
        <SecurityTraining trainings={trainings || []} />
      </div>

      <div className="mt-6">
        <RecentNotifications />
      </div>
    </AppLayout>
  );
}
