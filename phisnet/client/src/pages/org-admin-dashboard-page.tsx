import AppLayout from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Users, BarChart3, Shield, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function OrgAdminDashboardPage() {
  const { user, isLoading } = useAuth();

  // Show a loader instead of a blank screen while auth loads
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If somehow user not present after loading, prompt for re-auth
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">Session expired</p>
          <p className="text-muted-foreground">Please log in via the org admin portal.</p>
          <a
            href="/auth?mode=org-admin"
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90"
          >
            Org Admin Login
          </a>
        </div>
      </div>
    );
  }

  // Fetch limited organization-specific stats (avoid global admin endpoints)
  const { data: campaignStats } = useQuery({
    queryKey: ["/api/campaigns", "stats", user.organizationId],
    queryFn: async () => {
      const res = await fetch("/api/campaigns?scope=org-admin");
      if (!res.ok) return { active: 0, clicks: 0, openRate: 0 };
      const data = await res.json();
      // Derive minimal stats locally
      const active = Array.isArray(data) ? data.filter((c: any) => c.status === "running").length : 0;
      const clicks = Array.isArray(data) ? data.reduce((sum: number, c: any) => sum + (c.totalClicks || 0), 0) : 0;
      const openRate = Array.isArray(data) && data.length > 0
        ? data.reduce((sum: number, c: any) => sum + (c.openRate || 0), 0) / data.length
        : 0;
      return { active, clicks, openRate };
    },
    enabled: !!user,
  });

  const { data: orgUsers } = useQuery({
    queryKey: ["/api/users", user.organizationId],
    queryFn: async () => {
      const res = await fetch("/api/users?scope=org-admin");
      if (!res.ok) return [];
      const data = await res.json();
      // Filter strictly to same organization client-side as an extra guard
      return Array.isArray(data) ? data.filter((u: any) => u.organizationId === user.organizationId) : [];
    },
    enabled: !!user,
  });

  const userCount = orgUsers?.length || 0;
  const activeCampaigns = campaignStats?.active || 0;
  const totalClicks = campaignStats?.clicks || 0;
  const avgOpenRate = campaignStats?.openRate || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Org Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome, {user.firstName}. Organization scope: {user.organizationName}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
              <p className="text-xs text-muted-foreground">Active in organization</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCampaigns}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClicks}</div>
              <p className="text-xs text-muted-foreground">Phishing interactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgOpenRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Across org campaigns</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Allowed Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Manage campaigns for this organization only</li>
              <li>Enroll employees (not global admins)</li>
              <li>Review awareness performance metrics</li>
              <li>Access reports scoped to this organization</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
