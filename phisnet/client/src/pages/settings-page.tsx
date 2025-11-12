import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { 
  Lock, 
  Bell, 
  Moon, 
  Sun, 
  Mail, 
  Shield, 
  RefreshCw, 
  AlertTriangle,
  Loader2,
  X,
  ArrowLeft,
  BarChart3,
  Info as InfoIcon
} from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const { theme, setTheme } = useTheme();
  
  // Get tab from query string
  const getTabFromQuery = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'notifications' || tab === 'appearance' || tab === 'account') {
        return tab;
      }
    }
    return 'account';
  };
  const [selectedTab, setSelectedTab] = useState(getTabFromQuery());
  // Watch for changes in location
  useEffect(() => {
    setSelectedTab(getTabFromQuery());
  }, [location]);
  // State for various settings
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  useEffect(() => {
    // Load saved session timeout or default to 30 minutes
    const savedTimeout = localStorage.getItem('sessionTimeoutMinutes');
    if (savedTimeout) {
      setSessionTimeout(parseInt(savedTimeout));
    }
  }, []);
  
  // Handle theme toggle
  const handleThemeToggle = (isDark: boolean) => {
    const newTheme = isDark ? "dark" : "light";
    setTheme(newTheme);
    
    toast({
      title: "Theme Updated",
      description: `Switched to ${newTheme} mode`,
    });
  };
  
  // Handle session timeout change
  const handleSessionTimeoutChange = async (minutes: number) => {
    try {
      // Update the local state
      setSessionTimeout(minutes);
      
      // Store in local storage to persist between page loads
      localStorage.setItem('sessionTimeoutMinutes', minutes.toString());
      
      toast({
        title: "Settings Updated",
        description: `Session timeout set to ${minutes} minutes. This will take effect after you refresh the page.`,
      });
    } catch (error) {
      console.error('Error updating session timeout:', error);
      toast({
        title: "Error",
        description: "Failed to update session timeout setting",
        variant: "destructive"
      });
    }
  };
  
  // Handle password input change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };
  
  // Handle password form submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    
    // Password validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      setIsChangingPassword(false);
      return;
    }
    
    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(passwordForm.newPassword)) {
      toast({
        title: "Password too weak",
        description: "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
        variant: "destructive",
      });
      setIsChangingPassword(false);
      return;
    }
    
    try {
      // Call the API to change the password
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update password');
      }
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast({
        title: "Password update failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle close/back navigation
  const handleClose = () => {
    navigate("/");
  };
  
  // Update your settings page with proper save functionality
  const handleSaveSettings = async (section: string, data: any) => {
    try {
      const response = await fetch(`/api/user/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: "Settings saved",
        description: `Your ${section} settings have been updated successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="container max-w-4xl py-6 mx-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-center">Settings</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleClose}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
  <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="account">
            <Shield className="h-4 w-4 mr-2" />
            Account Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Sun className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>
        
        {/* Account Security Tab */}
        <TabsContent value="account">
          <div className="grid gap-6">
            {/* Password Change Card */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to maintain account security
                </CardDescription>
              </CardHeader>
              <form onSubmit={handlePasswordSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                    />
                  </div>
                  
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Password Requirements</AlertTitle>
                    <AlertDescription>
                      Password must be at least 8 characters and include uppercase, lowercase, 
                      number, and special character.
                    </AlertDescription>
                  </Alert>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    disabled={isChangingPassword}
                    className="ml-auto"
                  >
                    {isChangingPassword && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Change Password
                  </Button>
                </CardFooter>
              </form>
            </Card>
            
            {/* Session Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Session Settings</CardTitle>
                <CardDescription>
                  Manage your session timeout and security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="sessionTimeout" className="text-sm font-medium">
                    Session Timeout (minutes)
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={sessionTimeout}
                      onChange={(e) => handleSessionTimeoutChange(parseInt(e.target.value))}
                      min={10}
                      max={120}
                      className="max-w-[100px]"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => handleSessionTimeoutChange(30)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset to Default
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your session will expire after {sessionTimeout} minutes of inactivity. 
                    Warning will appear 2 minutes before expiration.
                  </p>
                </div>
                
                <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Account Security</AlertTitle>
                  <AlertDescription>
                    Your account will be locked after 10 failed login attempts for 30 minutes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="darkMode">
                    <div className="flex items-center">
                      {theme === "dark" ? (
                        <Moon className="h-4 w-4 mr-2" />
                      ) : (
                        <Sun className="h-4 w-4 mr-2" />
                      )}
                      Dark Mode
                    </div>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Switch between light and dark themes
                  </p>
                </div>
                <Switch
                  id="darkMode"
                  checked={theme === "dark"}
                  onCheckedChange={handleThemeToggle}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}