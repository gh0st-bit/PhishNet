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
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import LogoImg from '@/assets/logo.jpg';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/", icon: <BarChart3 className="h-5 w-5" /> },
    { name: "Campaigns", href: "/campaigns", icon: <Mail className="h-5 w-5" /> },
    { name: "Templates", href: "/templates", icon: <FolderOpen className="h-5 w-5" /> },
    { name: "Groups", href: "/groups", icon: <Users className="h-5 w-5" /> },
    { name: "Landing Pages", href: "/landing-pages", icon: <Layout className="h-5 w-5" /> },
    { name: "SMTP Profiles", href: "/smtp-profiles", icon: <Send className="h-5 w-5" /> },
    { name: "Threat Landscape", href: "/threat-landscape", icon: <AlertTriangle className="h-5 w-5" /> },
    { name: "Reports", href: "/reports", icon: <BarChart className="h-5 w-5" /> },
    { name: "Users", href: "/users", icon: <Shield className="h-5 w-5" /> },
    { name: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
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
        "bg-card w-64 border-r border-border z-30",
        "transition-transform duration-200 ease-in-out transform",
        "fixed inset-y-0 left-0 md:relative md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-center h-16 border-b border-border">
          <div className="flex items-center space-x-2">
            <img src={LogoImg} alt="PhishNet Logo" className="h-6 w-6" />
            <span className="text-xl font-bold text-foreground">PhishNet</span>
          </div>
        </div>
        <nav className="mt-5 px-4">
          <div className="space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
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
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
