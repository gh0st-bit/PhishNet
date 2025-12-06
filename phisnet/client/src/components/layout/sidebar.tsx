import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Mail, 
  FolderOpen, 
  Users, 
  Layout, 
  Send, 
  BarChart, 
  Shield, 
  Settings, 
  Menu,
  AlertTriangle,
  Search,
  Calendar,
  FileText,
  ChevronDown,
  ChevronRight,
  BookOpen,
  HelpCircle,
  Award,
  GraduationCap,
  Trophy,
  UserPlus,
  Layers,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Logo } from "@/components/common/logo";
import { useAuth } from "@/hooks/use-auth";

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavigationItem[];
  adminOnly?: boolean;
  orgAdminOnly?: boolean;
  userOnly?: boolean;
}

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const isAdmin = user?.isAdmin;
  const isOrgAdmin = user?.roles?.includes("OrgAdmin");
  // Treat org admins as distinct from employees so they cannot see
  // or navigate to employee-only pages.
  const isEmployee = !user?.isAdmin && !isOrgAdmin && user?.roles?.includes("User");

  // Initialize expandedItems based on current location
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const initial: string[] = [];
    const contentPaths = [
      '/admin/content/articles',
      '/admin/content/videos',
      '/admin/content/flashcards',
      '/admin/content/mcqs'
    ];
    
    const isOnContentPage = contentPaths.some(path => location.startsWith(path));
    if (isOnContentPage) {
      initial.push('Content');
    }
    
    return initial;
  });

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const navigation: NavigationItem[] = [
    // Admin-only navigation
    { 
      name: "Dashboard", 
      href: "/", 
      icon: <BarChart3 className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Campaigns", 
      href: "/campaigns", 
      icon: <Mail className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Credential Captures", 
      href: "/admin/credential-captures", 
      icon: <Shield className="h-5 w-5" />,
      adminOnly: true
    },
    // ...other admin items...
    { 
      name: "Enrollment", 
      href: "/enrollment", 
      icon: <UserPlus className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Manage Organizations", 
      href: "/organization-management", 
      icon: <Building2 className="h-5 w-5" />,
      adminOnly: true
    },
    {
      name: "Content",
      icon: <FolderOpen className="h-5 w-5" />,
      adminOnly: true,
      children: [
        { name: "Articles", href: "/admin/content/articles", icon: <FileText className="h-4 w-4" /> },
        { name: "Videos", href: "/admin/content/videos", icon: <FolderOpen className="h-4 w-4" /> },
        { name: "Flashcards", href: "/admin/content/flashcards", icon: <BookOpen className="h-4 w-4" /> },
        { name: "MCQs", href: "/admin/content/mcqs", icon: <HelpCircle className="h-4 w-4" /> },
      ]
    },
    { 
      name: "Reconnaissance", 
      href: "/reconnaissance", 
      icon: <Search className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Templates", 
      href: "/templates", 
      icon: <FolderOpen className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Groups", 
      href: "/groups", 
      icon: <Users className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Landing Pages", 
      href: "/landing-pages", 
      icon: <Layout className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "SMTP Profiles", 
      href: "/smtp-profiles", 
      icon: <Send className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Threat Landscape", 
      href: "/threat-landscape", 
      icon: <AlertTriangle className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Reports", 
      href: "/reports", 
      icon: <BarChart className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Report Schedules", 
      href: "/report-schedules", 
      icon: <Calendar className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Audit Logs", 
      href: "/audit-logs", 
      icon: <FileText className="h-5 w-5" />,
      adminOnly: true
    },
    { 
      name: "Users", 
      href: "/users", 
      icon: <Shield className="h-5 w-5" />,
      adminOnly: true
    },
    
    // Org Admin navigation (limited to their organization)
    { 
      name: "Dashboard", 
      href: "/org-admin", 
      icon: <BarChart3 className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Campaigns", 
      href: "/org-admin/campaigns", 
      icon: <Mail className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Templates", 
      href: "/org-admin/templates", 
      icon: <FolderOpen className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Landing Pages", 
      href: "/org-admin/landing-pages", 
      icon: <Layout className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "SMTP Profiles", 
      href: "/org-admin/smtp-profiles", 
      icon: <Send className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Enrollment", 
      href: "/org-admin/enrollment", 
      icon: <UserPlus className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Groups", 
      href: "/org-admin/groups", 
      icon: <Users className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Users", 
      href: "/org-admin/users", 
      icon: <Shield className="h-5 w-5" />,
      orgAdminOnly: true
    },
    { 
      name: "Reports", 
      href: "/org-admin/reports", 
      icon: <BarChart className="h-5 w-5" />,
      orgAdminOnly: true
    },
    
    // Employee Portal (user-only)
    {
      name: "Employee Portal",
      icon: <GraduationCap className="h-5 w-5" />,
      userOnly: true,
      children: [
        { name: "My Dashboard", href: "/employee", icon: <BarChart3 className="h-4 w-4" />, userOnly: true },
        { 
          name: "Training", 
          href: "/employee/training", 
          icon: <BookOpen className="h-4 w-4" />,
          userOnly: true
        },
        { 
          name: "Quizzes", 
          href: "/employee/quizzes", 
          icon: <HelpCircle className="h-4 w-4" />,
          userOnly: true
        },
        { 
          name: "Articles", 
          href: "/employee/articles", 
          icon: <FileText className="h-4 w-4" />,
          userOnly: true
        },
        { 
          name: "Flashcards", 
          href: "/employee/flashcards", 
          icon: <Layers className="h-4 w-4" />,
          userOnly: true
        },
        { 
          name: "Badges", 
          href: "/employee/badges", 
          icon: <Award className="h-4 w-4" />,
          userOnly: true
        },
        { 
          name: "Leaderboard", 
          href: "/employee/leaderboard", 
          icon: <Trophy className="h-4 w-4" />,
          userOnly: true
        },
      ]
    },
    
    // Common settings
    { 
      name: "Settings", 
      href: "/settings", 
      icon: <Settings className="h-5 w-5" /> 
    },
  ];

  const toggleMobile = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <>
      {/* Mobile menu button - improved touch target */}
      <div className="fixed top-3 left-3 z-40 md:hidden">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleMobile}
          className="h-11 w-11 touch-manipulation"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Sidebar - responsive width and smooth animations */}
      <aside className={cn(
        "bg-card border-r border-border z-30 flex flex-col",
        "w-[280px] sm:w-72 md:w-64",
        "transition-transform duration-300 ease-out transform",
        "fixed inset-y-0 left-0 md:relative md:translate-x-0",
        "shadow-2xl md:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-center h-16 sm:h-18 border-b border-border shrink-0">
          <div className="flex items-center space-x-2">
            <Logo className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="text-xl sm:text-2xl font-bold text-foreground">PhishNet</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto mt-5 px-4 pb-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              // Filter based on role
              if (item.adminOnly && !isAdmin) return null;
              if (item.orgAdminOnly && !isOrgAdmin) return null;
              if (item.userOnly && !isEmployee) return null;

              const isExpanded = expandedItems.includes(item.name);
              const hasChildren = item.children && item.children.length > 0;
              const isActive = location === item.href;
              const isChildActive = item.children?.some(child => location === child.href);

              return (
                <div key={item.name}>
                  {hasChildren ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          "w-full group flex items-center justify-between px-3 py-2.5 text-base rounded-md cursor-pointer touch-manipulation",
                          "min-h-[44px]",
                          isChildActive
                            ? "bg-secondary/50 text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground active:bg-secondary/70"
                        )}
                        onClick={() => toggleExpanded(item.name)}
                      >
                        <div className="flex items-center">
                          <span className={cn(
                            "mr-3",
                            isChildActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {item.icon}
                          </span>
                          <span>{item.name}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-border pl-4">
                          {item.children?.map((child) => {
                            // Filter children based on role
                            if (child.adminOnly && !isAdmin) return null;
                            if (child.orgAdminOnly && !isOrgAdmin) return null;
                            if (child.userOnly && !isEmployee) return null;

                            const isChildItemActive = location === child.href;
                            return (
                              <Link
                                key={child.name}
                                href={child.href!}
                              >
                                <div
                                  className={cn(
                                    "group flex items-center px-3 py-2 text-sm rounded-md cursor-pointer touch-manipulation",
                                    "min-h-[40px]",
                                    isChildItemActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground active:bg-secondary/70"
                                  )}
                                >
                                  <span className="mr-2">
                                    {child.icon}
                                  </span>
                                  <span>{child.name}</span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href!}
                      onClick={() => setMobileOpen(false)}
                    >
                      <div
                        className={cn(
                          "group flex items-center px-3 py-2.5 text-base rounded-md cursor-pointer touch-manipulation",
                          "min-h-[44px]",
                          isActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground active:bg-secondary/70"
                        )}
                      >
                        <span className={cn(
                          "mr-3",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.icon}
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Backdrop for mobile - animated */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/60 z-20 md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
    </>
  );
}
