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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { useAuth } from "@/hooks/use-auth";

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavigationItem[];
  adminOnly?: boolean;
  userOnly?: boolean;
}

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Employee Portal']);
  const { user } = useAuth();

  const isAdmin = user?.isAdmin;
  const isEmployee = !user?.isAdmin;

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
    // ...other admin items...
    { 
      name: "Enrollment", 
      href: "/enrollment", 
      icon: <UserPlus className="h-5 w-5" />,
      adminOnly: true
    },
    {
      name: "Content",
      icon: <FolderOpen className="h-5 w-5" />,
      adminOnly: true,
      children: [
        { name: "Articles", href: "/admin/content/articles", icon: <FileText className="h-4 w-4" /> },
        { name: "Blogs", href: "/admin/content/blogs", icon: <FileText className="h-4 w-4" /> },
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
    { 
      name: "Enrollment", 
      href: "/enrollment", 
      icon: <UserPlus className="h-5 w-5" />,
      adminOnly: true
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
      {/* Mobile menu button */}
      <div className="absolute top-4 left-4 z-40 md:hidden">
        <Button variant="ghost" size="icon" onClick={toggleMobile}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-card w-64 border-r border-border z-30 flex flex-col",
        "transition-transform duration-200 ease-in-out transform",
        "fixed inset-y-0 left-0 md:relative md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-center h-16 border-b border-border shrink-0">
          <div className="flex items-center space-x-2">
            <Logo className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground">PhishNet</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto mt-5 px-4 pb-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              // Filter based on role
              if (item.adminOnly && !isAdmin) return null;
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
                          "w-full group flex items-center justify-between px-2 py-2 text-base rounded-md cursor-pointer",
                          isChildActive
                            ? "bg-secondary/50 text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
                            if (child.userOnly && !isEmployee) return null;

                            const isChildItemActive = location === child.href;
                            return (
                              <Link
                                key={child.name}
                                href={child.href!}
                                onClick={() => setMobileOpen(false)}
                              >
                                <div
                                  className={cn(
                                    "group flex items-center px-2 py-1.5 text-sm rounded-md cursor-pointer",
                                    isChildItemActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
                          "group flex items-center px-2 py-2 text-base rounded-md cursor-pointer",
                          isActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
    </>
  );
}
