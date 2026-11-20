import { useTenantPreferences } from '@/hooks/use-tenant-preferences';
import { appRole } from '@shared/access-control';
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, ChevronDown, HelpCircle, User as UserIcon, Building, Settings, Search, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { homeFor } from "@shared/access-control";
import { Logo } from "@/components/common/logo";
import CommandPalette from "./command-palette";
import { Separator } from "@/components/ui/separator";
import { User } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NotificationBell from "@/components/notifications/notification-bell";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  user: User;
}

export default function Header({ user }: HeaderProps) {
  const {data:preferences,t}=useTenantPreferences();
  const [location] = useLocation();
  const { logoutMutation } = useAuth();

  const getPageTitle = () => {
    if(location==='/employee')return 'My dashboard';
    if(location==='/employee/inbox')return 'My inbox';
    const path = location.split("/")[1];
    if (path === "") return "Dashboard";
    return path.charAt(0).toUpperCase() + path.slice(1).replace("-", " ");
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/Cmd+K opens "Search or jump to…" from anywhere in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="pn-topbar glass glass-bar">
      <Link href={homeFor(user)} className="pn-logo" aria-label="PhishNet home">
        <Logo className="h-7 w-7" alt="" />
        <span className="hidden sm:inline">PhishNet</span>
      </Link>
      <button type="button" className="pn-search" onClick={() => setPaletteOpen(true)} aria-label="Search or jump to a page" aria-haspopup="dialog">
        <Search className="h-5 w-5 shrink-0" />
        <span className="hidden md:inline">Search or jump to…</span>
        <kbd className="hidden md:inline">Ctrl K</kbd>
      </button>
      <div className="hidden lg:flex items-baseline gap-3 min-w-0">
        <span className="text-sm text-muted-foreground truncate">{preferences?.brandName}</span>
        <h1 className="text-lg font-semibold text-foreground truncate">{t(getPageTitle())}</h1>
      </div>
      <span className="flex-1" />
      <div className="flex items-center gap-2">
        <button type="button" className="pn-ib" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="pn-ib pn-help touch-manipulation" aria-label="About PhishNet">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs sm:text-sm">
              <p>PhishNet: Advanced phishing simulation platform for security awareness training and threat assessment.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="pn-ib-host"><NotificationBell /></span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="pn-profile touch-manipulation">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.profilePicture || undefined} alt={`${user.firstName} ${user.lastName}`} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline-block text-sm">
                {user.firstName} {user.lastName}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Link href="/profile">
            <DropdownMenuItem>
              <UserIcon className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
          </Link>
          {['Admin','OrgAdmin'].includes(appRole(user)) && <Link href={appRole(user)==='Admin'?'/organization':'/org-admin/settings'}>
            <DropdownMenuItem>
              <Building className="h-4 w-4 mr-2" />
              Organization
            </DropdownMenuItem>
          </Link>}
          <Link href="/settings">
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
