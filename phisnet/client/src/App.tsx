import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard-page";
import AuthPage from "@/pages/auth-page";
import CampaignsPage from "@/pages/campaigns-page";
import TemplatesPage from "@/pages/templates-page";
import GroupsPage from "@/pages/groups-page";
import LandingPagesPage from "@/pages/landing-pages-page";
import SmtpProfilesPage from "@/pages/smtp-profiles-page";
import ReportsPage from "@/pages/reports-page";
import UsersPage from "@/pages/users-page";
import SettingsPage from "@/pages/settings-page";
import ProfilePage from "@/pages/profile-page";
import OrganizationPage from "@/pages/organization-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import ThreatLandscapePage from "@/pages/threat-landscape-page";
import SessionTimeoutWrapper from "@/components/session-timeout-wrapper";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { initSessionManager, cleanupSessionManager } from "@/lib/session-manager";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password/:token" component={ResetPasswordPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/campaigns" component={CampaignsPage} />
      <ProtectedRoute path="/templates" component={TemplatesPage} />
      <ProtectedRoute path="/groups" component={GroupsPage} />
      <ProtectedRoute path="/landing-pages" component={LandingPagesPage} />
      <ProtectedRoute path="/smtp-profiles" component={SmtpProfilesPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/users" component={UsersPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/organization" component={OrganizationPage} />
      <ProtectedRoute path="/threat-landscape" component={ThreatLandscapePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Create a separate component that uses the auth context
function AppContent() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      // Initialize session management when user is authenticated
      initSessionManager();
    } else {
      // Cleanup session management when user is not authenticated
      cleanupSessionManager();
    }

    // Cleanup on unmount
    return () => {
      cleanupSessionManager();
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SessionTimeoutWrapper>
      <QueryClientProvider client={queryClient}>
        {user ? (
          <Router />
        ) : (
          <Switch>
            <Route path="/auth" component={AuthPage} />
            <Route path="/forgot-password" component={ForgotPasswordPage} />
            <Route path="/reset-password/:token" component={ResetPasswordPage} />
            <Route path="/" component={AuthPage} />
          </Switch>
        )}
      </QueryClientProvider>
    </SessionTimeoutWrapper>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
