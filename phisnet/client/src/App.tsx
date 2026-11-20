import { lazy, Suspense } from 'react';
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotificationsPage from "./pages/notifications-page";
import SessionTimeoutWrapper from "@/components/session-timeout-wrapper";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { initSessionManager, cleanupSessionManager } from "@/lib/session-manager";


const ContentLibraryPage=lazy(()=>import('@/pages/content-library-page'));
const DemonstrationPage=lazy(()=>import('@/pages/demonstration-page'));
const EmployeeLearningPathsPage=lazy(()=>import('@/pages/employee-learning-paths-page'));
const EmployeeReportPage=lazy(()=>import('@/pages/employee-report-page'));
const EmployeeTrainingDetailPage=lazy(()=>import('@/pages/employee-training-detail-page'));
const PilotSetupPage=lazy(()=>import('@/pages/pilot-setup-page'));
const TenantSettingsPage=lazy(()=>import('@/pages/tenant-settings-page'));
const OperationsPage=lazy(()=>import('@/pages/operations-page'));
const DeliverySettingsPage = lazy(() => import('@/pages/delivery-settings-page'));
const TrainingAssignmentsPage = lazy(() => import('@/pages/training-assignments-page'));
const NotFound = lazy(() => import("@/pages/not-found"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const CampaignsPage = lazy(() => import("@/pages/campaigns-page"));
const ReconnaissancePage = lazy(() => import("@/pages/reconnaissance-page"));
const TemplatesPage = lazy(() => import("@/pages/templates-page"));
const GroupsPage = lazy(() => import("@/pages/groups-page"));
const LandingPagesPage = lazy(() => import("@/pages/landing-pages-page"));
const SmtpProfilesPage = lazy(() => import("@/pages/smtp-profiles-page"));
const ReportsPage = lazy(() => import("@/pages/reports-page"));
const ReportSchedulesPage = lazy(() => import("@/pages/report-schedules-page"));
const UsersPage = lazy(() => import("@/pages/users-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const OrganizationPage = lazy(() => import("@/pages/organization-page"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password-page"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password-page"));
const ThreatLandscapePage = lazy(() => import("@/pages/threat-landscape-page"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs-page"));
const EmployeeDashboardPage = lazy(() => import("@/pages/employee-dashboard-page"));
const EmployeeTrainingPage = lazy(() => import("@/pages/employee-training-page"));
const EmployeeQuizzesPage = lazy(() => import("@/pages/employee-quizzes-page"));
const EmployeeQuizTakePage = lazy(() => import("@/pages/employee-quiz-take-page"));
const EmployeeBadgesPage = lazy(() => import("@/pages/employee-badges-page"));
const EmployeeBadgeDetailPage = lazy(() => import("@/pages/employee-badge-detail-page"));
const EmployeeLeaderboardPage = lazy(() => import("@/pages/employee-leaderboard-page"));
const EmployeeProfilePage = lazy(() => import("@/pages/employee-profile-page"));
const EmployeeArticlesPage = lazy(() => import("@/pages/employee-articles-page"));
const EmployeeArticleDetailPage = lazy(() => import("@/pages/employee-article-detail-page"));
const EmployeeFlashcardsPage = lazy(() => import("@/pages/employee-flashcards-page"));
const AdminTrainingPage = lazy(() => import("@/pages/admin-training-page"));
const AdminQuizPage = lazy(() => import("@/pages/admin-quiz-page"));
const AdminBadgePage = lazy(() => import("@/pages/admin-badge-page"));
const AdminArticlesPage = lazy(() => import("@/pages/admin-articles-page"));
const AdminArticleCreatePage = lazy(() => import("@/pages/admin-article-create-page"));
const ManagerDashboardPage = lazy(()=>import('@/pages/manager-dashboard-page'));
const LocalInboxPage = lazy(()=>import('@/pages/local-inbox-page'));
const AdminVideosPage = lazy(() => import("@/pages/admin-videos-page"));
const AdminFlashcardsPage = lazy(() => import("@/pages/admin-flashcards-page"));
const AdminMcqsPage = lazy(() => import("@/pages/admin-mcqs-page"));
const CaptureLoginPage = lazy(() => import("@/pages/capture-login"));
const AdminCredentialCapturesPage = lazy(() => import("@/pages/admin-credential-captures-page"));
const OrgAdminDashboardPage = lazy(() => import("@/pages/org-admin-dashboard-page"));
const OrgAdminCampaignsPage = lazy(() => import("@/pages/org-admin-campaigns-page"));
const OrgAdminGroupsPage = lazy(() => import("@/pages/org-admin-groups-page"));
const OrgAdminUsersPage = lazy(() => import("@/pages/org-admin-users-page"));
const OrgAdminReportsPage = lazy(() => import("@/pages/org-admin-reports-page"));
const OrgAdminEnrollmentPage = lazy(() => import("@/pages/org-admin-enrollment-page"));
const OrgAdminTemplatesPage = lazy(() => import("@/pages/org-admin-templates-page"));
const OrgAdminSmtpProfilesPage = lazy(() => import("@/pages/org-admin-smtp-profiles-page"));
const OrgAdminLandingPagesPage = lazy(() => import("@/pages/org-admin-landing-pages-page"));
const EnrollmentPage = lazy(() => import("@/pages/enrollment-page"));
const OrganizationManagementPage = lazy(() => import("@/pages/organization-management-page"));
const AcceptInvitePage = lazy(() => import("@/pages/accept-invite-page"));
function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/c/login" component={CaptureLoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password/:token" component={ResetPasswordPage} />
      <Route path="/accept-invite/:token" component={AcceptInvitePage} />
      <ProtectedRoute path="/org-admin/content-library" component={ContentLibraryPage} />
      <ProtectedRoute path="/walkthrough" component={DemonstrationPage} />
      <ProtectedRoute path="/admin/operations" component={OperationsPage} />
      <ProtectedRoute path="/org-admin" component={OrgAdminDashboardPage} />
      <ProtectedRoute path="/manager" component={ManagerDashboardPage} />
      <ProtectedRoute path="/local-inbox" component={LocalInboxPage} />
      <ProtectedRoute path="/org-admin/setup" component={PilotSetupPage} />
      <ProtectedRoute path="/org-admin/settings" component={TenantSettingsPage} />
      <ProtectedRoute path="/org-admin/delivery" component={DeliverySettingsPage} />
      <ProtectedRoute path="/org-admin/training-assignments" component={TrainingAssignmentsPage} />
      <ProtectedRoute path="/org-admin/campaigns" component={OrgAdminCampaignsPage} />
      <ProtectedRoute path="/org-admin/groups" component={OrgAdminGroupsPage} />
      <ProtectedRoute path="/org-admin/users" component={OrgAdminUsersPage} />
      <ProtectedRoute path="/org-admin/reports" component={OrgAdminReportsPage} />
      <ProtectedRoute path="/org-admin/enrollment" component={OrgAdminEnrollmentPage} />
      <ProtectedRoute path="/org-admin/templates" component={OrgAdminTemplatesPage} />
      <ProtectedRoute path="/org-admin/smtp-profiles" component={OrgAdminSmtpProfilesPage} />
      <ProtectedRoute path="/org-admin/landing-pages" component={OrgAdminLandingPagesPage} />
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
      <ProtectedRoute path="/organization-management" component={OrganizationManagementPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/organization" component={OrganizationPage} />
      <ProtectedRoute path="/threat-landscape" component={ThreatLandscapePage} />
  <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/audit-logs" component={AuditLogsPage} />
      <ProtectedRoute path="/employee" component={EmployeeDashboardPage} />
      <ProtectedRoute path="/employee/learning-paths" component={EmployeeLearningPathsPage} />
      <ProtectedRoute path="/employee/report" component={EmployeeReportPage} />
      <ProtectedRoute path="/employee/inbox" component={LocalInboxPage} />
      <ProtectedRoute path="/employee/training" component={EmployeeTrainingPage} />
      <ProtectedRoute path="/employee/training/:id" component={EmployeeTrainingDetailPage} />
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
      <ProtectedRoute path="/admin/content/articles/edit/:id" component={AdminArticleCreatePage} />
      <ProtectedRoute path="/admin/content/videos" component={AdminVideosPage} />
      <ProtectedRoute path="/admin/content/flashcards" component={AdminFlashcardsPage} />
      <ProtectedRoute path="/admin/content/mcqs" component={AdminMcqsPage} />
      <ProtectedRoute path="/admin/credential-captures" component={AdminCredentialCapturesPage} />
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
            <Route path="/c/login" component={CaptureLoginPage} />
            <Route path="/org-admin" component={AuthPage} />
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
          <Suspense fallback={<div role="status" className="p-6">Loading page...</div>}><AppContent /></Suspense>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
