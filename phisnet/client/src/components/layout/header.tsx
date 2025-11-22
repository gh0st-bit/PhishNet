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
import { Bell, ChevronDown, HelpCircle, User as UserIcon, Building, Settings } from "lucide-react";
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
  const [location] = useLocation();
  const { logoutMutation } = useAuth();

  const getPageTitle = () => {
    const path = location.split("/")[1];
    if (path === "") return "Dashboard";
    return path.charAt(0).toUpperCase() + path.slice(1).replace("-", " ");
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;

  return (
    <header className="bg-card shadow-sm z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          <div className="flex items-center pl-14 md:pl-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-foreground truncate">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-1 sm:space-x-2 text-muted-foreground hover:text-foreground h-10 sm:h-10 touch-manipulation">
                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                      <AvatarImage src={user.profilePicture || undefined} alt={`${user.firstName} ${user.lastName}`} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline-block text-sm">
                      {user.firstName} {user.lastName}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                  <Link href="/organization">
                    <DropdownMenuItem>
                      <Building className="h-4 w-4 mr-2" />
                      Organization
                    </DropdownMenuItem>
                  </Link>
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
            <div className="flex items-center space-x-2 sm:space-x-3">
              <NotificationBell />
              <Separator orientation="vertical" className="h-5 sm:h-6" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation">
                      <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs sm:text-sm">
                    <p>PhishNet: Advanced phishing simulation platform for security awareness training and threat assessment.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
