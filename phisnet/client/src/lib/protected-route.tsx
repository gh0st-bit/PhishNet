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
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Role-based redirect for root path
  if (path === "/" && !user.isAdmin) {
    return (
      <Route path={path}>
        <Redirect to="/employee" />
      </Route>
    );
  }

  // Prevent regular users from accessing admin routes
  // Treat any route under /admin as admin-only and also explicit admin pages
  const adminPrefixes = ["/admin"];
  const adminRoutes = [
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
    "/users"
  ];

  const isAdminPath = adminPrefixes.some(p => path.startsWith(p)) || adminRoutes.some(route => path.startsWith(route));
  if (!user.isAdmin && isAdminPath) {
    return (
      <Route path={path}>
        <Redirect to="/employee" />
      </Route>
    );
  }

  // Prevent admins from accessing employee routes
  const employeeRoutesPrefix = "/employee";
  if (user.isAdmin && path.startsWith(employeeRoutesPrefix)) {
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
