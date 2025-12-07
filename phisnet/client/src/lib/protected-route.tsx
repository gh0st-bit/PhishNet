import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: Readonly<{
  path: string;
  component: () => React.JSX.Element;
}>) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to={path.startsWith("/org-admin") ? "/auth?mode=org-admin" : "/auth"} />
      </Route>
    );
  }

  const roles: string[] = Array.isArray((user as any).roles) ? (user as any).roles : [];
  const isGlobalAdmin = user.isAdmin || roles.includes("Admin");
  const isOrgAdmin = roles.includes("OrgAdmin") && !isGlobalAdmin;
  const isEmployee = roles.includes("User") && !isGlobalAdmin && !isOrgAdmin;

  // Explicitly route each protected area by role

  // 1) Global admin-only areas (root dashboard + classic admin pages)
  const adminPrefixes = ["/admin"]; // keep for any future nested admin routes
  const adminRoutes = [
    "/",
    "/campaigns",
    "/reconnaissance",
    "/templates",
    "/groups",
    "/landing-pages",
    "/smtp-profiles",
    "/threat-landscape",
    "/reports",
    "/report-schedules",
    "/audit-logs",
    "/users",
    "/enrollment",
    "/organization-management",
    "/organization",
  ];

  const isAdminPath = adminPrefixes.some((p) => path.startsWith(p)) || adminRoutes.some((route) => path === route);

  if (isAdminPath) {
    // Only global admins allowed here
    if (!isGlobalAdmin) {
      return (
        <Route path={path}>
          <Redirect to="/employee" />
        </Route>
      );
    }
  }

  // 2) Org admin portal
  const orgAdminPrefix = "/org-admin";
  if (path.startsWith(orgAdminPrefix)) {
    if (!isOrgAdmin && !isGlobalAdmin) {
      // Only org admins and global admins allowed
      return (
        <Route path={path}>
          <Redirect to="/employee" />
        </Route>
      );
    }
  }

  // 3) Employee portal
  const employeePrefix = "/employee";
  if (path.startsWith(employeePrefix)) {
    if (!isEmployee) {
      // Only employees allowed; admins/org-admins redirect to their dashboard
      const redirectTo = isGlobalAdmin ? "/" : isOrgAdmin ? "/org-admin" : "/";
      return (
        <Route path={path}>
          <Redirect to={redirectTo} />
        </Route>
      );
    }
  }

  return <Route path={path} component={Component} />;
}
