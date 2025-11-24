import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard-page";
import AuthPage from "@/pages/auth-page";
import CampaignsPage from "@/pages/campaigns-page";
import ReconnaissancePage from "@/pages/reconnaissance-page";
import TemplatesPage from "@/pages/templates-page";
import GroupsPage from "@/pages/groups-page";
import LandingPagesPage from "@/pages/landing-pages-page";
import SmtpProfilesPage from "@/pages/smtp-profiles-page";
import ReportsPage from "@/pages/reports-page";
import ReportSchedulesPage from "@/pages/report-schedules-page";
import UsersPage from "@/pages/users-page";
import SettingsPage from "@/pages/settings-page";
import ProfilePage from "@/pages/profile-page";
import OrganizationPage from "@/pages/organization-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import ThreatLandscapePage from "@/pages/threat-landscape-page";
import NotificationsPage from "./pages/notifications-page";
import AuditLogsPage from "@/pages/audit-logs-page";
import EmployeeDashboardPage from "@/pages/employee-dashboard-page";
import EmployeeTrainingPage from "@/pages/employee-training-page";
import EmployeeQuizzesPage from "@/pages/employee-quizzes-page";
import EmployeeQuizTakePage from "@/pages/employee-quiz-take-page";
import EmployeeBadgesPage from "@/pages/employee-badges-page";
import EmployeeBadgeDetailPage from "@/pages/employee-badge-detail-page";
import EmployeeLeaderboardPage from "@/pages/employee-leaderboard-page";
import EmployeeProfilePage from "@/pages/employee-profile-page";
import EmployeeArticlesPage from "@/pages/employee-articles-page";
import EmployeeArticleDetailPage from "@/pages/employee-article-detail-page";
import EmployeeFlashcardsPage from "@/pages/employee-flashcards-page";
import AdminTrainingPage from "@/pages/admin-training-page";
import AdminQuizPage from "@/pages/admin-quiz-page";
import AdminBadgePage from "@/pages/admin-badge-page";
import AdminArticlesPage from "@/pages/admin-articles-page";
import AdminArticleCreatePage from "@/pages/admin-article-create-page";
import AdminVideosPage from "@/pages/admin-videos-page";
import AdminFlashcardsPage from "@/pages/admin-flashcards-page";
import AdminMcqsPage from "@/pages/admin-mcqs-page";
import EnrollmentPage from "@/pages/enrollment-page";
import AcceptInvitePage from "@/pages/accept-invite-page";
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
      <Route path="/accept-invite/:token" component={AcceptInvitePage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/campaigns" component={CampaignsPage} />
      <ProtectedRoute path="/reconnaissance" component={ReconnaissancePage} />
      <ProtectedRoute path="/templates" component={TemplatesPage} />
      <ProtectedRoute path="/groups" component={GroupsPage} />
      <ProtectedRoute path="/landing-pages" component={LandingPagesPage} />
      <ProtectedRoute path="/smtp-profiles" component={SmtpProfilesPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/report-schedules" component={ReportSchedulesPage} />
      <ProtectedRoute path="/users" component={UsersPage} />
      <ProtectedRoute path="/enrollment" component={EnrollmentPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/organization" component={OrganizationPage} />
      <ProtectedRoute path="/threat-landscape" component={ThreatLandscapePage} />
  <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/audit-logs" component={AuditLogsPage} />
      <ProtectedRoute path="/employee" component={EmployeeDashboardPage} />
      <ProtectedRoute path="/employee/training" component={EmployeeTrainingPage} />
      <ProtectedRoute path="/employee/quizzes" component={EmployeeQuizzesPage} />
      <ProtectedRoute path="/employee/quizzes/:id" component={EmployeeQuizTakePage} />
      <ProtectedRoute path="/employee/badges" component={EmployeeBadgesPage} />
      <ProtectedRoute path="/employee/badges/:id" component={EmployeeBadgeDetailPage} />
      <ProtectedRoute path="/employee/leaderboard" component={EmployeeLeaderboardPage} />
      <ProtectedRoute path="/employee/profile" component={EmployeeProfilePage} />
      <ProtectedRoute path="/employee/articles" component={EmployeeArticlesPage} />
      <ProtectedRoute path="/employee/articles/:id" component={EmployeeArticleDetailPage} />
      <ProtectedRoute path="/employee/flashcards" component={EmployeeFlashcardsPage} />
      <ProtectedRoute path="/admin/training" component={AdminTrainingPage} />
      <ProtectedRoute path="/admin/quizzes" component={AdminQuizPage} />
      <ProtectedRoute path="/admin/badges" component={AdminBadgePage} />
      <ProtectedRoute path="/admin/content/articles" component={AdminArticlesPage} />
      <ProtectedRoute path="/admin/content/articles/new" component={AdminArticleCreatePage} />
      <ProtectedRoute path="/admin/content/videos" component={AdminVideosPage} />
      <ProtectedRoute path="/admin/content/flashcards" component={AdminFlashcardsPage} />
      <ProtectedRoute path="/admin/content/mcqs" component={AdminMcqsPage} />
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
            <Route path="/accept-invite/:token" component={AcceptInvitePage} />
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
