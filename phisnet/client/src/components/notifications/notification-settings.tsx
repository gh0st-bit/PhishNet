import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { EmailSettings } from "@/components/email/email-settings";
import { 
  Mail, 
  Shield, 
  RefreshCw, 
  Bell,
  BarChart3,
  Info as InfoIcon,
  Loader2
} from "lucide-react";

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  campaignAlerts: boolean;
  securityAlerts: boolean;
  systemUpdates: boolean;
  weeklyReports: boolean;
}

export function NotificationSettings() {
  const { toast } = useToast();
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    campaignAlerts: true,
    securityAlerts: true,
    systemUpdates: true,
    weeklyReports: true,
  });

  useEffect(() => {
    fetchNotificationPreferences();
  }, []);

  // Fetch notification preferences from API
  const fetchNotificationPreferences = async () => {
    try {
      setLoadingPreferences(true);
      const response = await fetch('/api/notifications/preferences', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }
      
      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive"
      });
    } finally {
      setLoadingPreferences(false);
    }
  };

  // Handle settings toggle
  const handleToggle = async (setting: keyof NotificationPreferences, value: boolean) => {
    try {
      const updatedPreferences = {
        ...preferences,
        [setting]: value
      };
      
      setPreferences(updatedPreferences);
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPreferences),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }
      
      toast({
        title: "Setting updated",
        description: "Your notification preference has been saved.",
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update notification preference",
        variant: "destructive"
      });
      
      // Revert the UI state on error
      fetchNotificationPreferences();
    }
  };

  return (
    <Tabs defaultValue="dashboard">
      <TabsList className="mb-4 w-full max-w-md mx-auto">
        <TabsTrigger value="dashboard" className="flex-1">
          <Bell className="h-4 w-4 mr-2" /> 
          Dashboard Notifications
        </TabsTrigger>
        <TabsTrigger value="email" className="flex-1">
          <Mail className="h-4 w-4 mr-2" />
          Email Notifications
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="dashboard">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Notification Preferences</CardTitle>
            <CardDescription>
              Configure which notifications appear in your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingPreferences ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pushNotifications">
                        <div className="flex items-center">
                          <Bell className="h-4 w-4 mr-2" />
                          Push Notifications
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive real-time notifications in the dashboard
                      </p>
                    </div>
                    <Switch
                      id="pushNotifications"
                      checked={preferences.pushNotifications}
                      onCheckedChange={(value) => handleToggle("pushNotifications", value)}
                    />
                  </div>
                </div>
                
                <div className={`border-t pt-4 space-y-4 ${!preferences.pushNotifications ? 'opacity-50' : ''}`}>
                  <h3 className="text-lg font-medium">Notification Types</h3>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="campaignAlerts">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2" />
                          Campaign Alerts
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications about campaign activities (email opens, clicks, form submissions)
                      </p>
                    </div>
                    <Switch
                      id="campaignAlerts"
                      checked={preferences.campaignAlerts}
                      disabled={!preferences.pushNotifications}
                      onCheckedChange={(value) => handleToggle("campaignAlerts", value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="securityAlerts">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 mr-2" />
                          Security Alerts
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Important security-related notifications and alerts
                      </p>
                    </div>
                    <Switch
                      id="securityAlerts"
                      checked={preferences.securityAlerts}
                      disabled={!preferences.pushNotifications}
                      onCheckedChange={(value) => handleToggle("securityAlerts", value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="systemUpdates">
                        <div className="flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          System Updates
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications about system updates and maintenance
                      </p>
                    </div>
                    <Switch
                      id="systemUpdates"
                      checked={preferences.systemUpdates}
                      disabled={!preferences.pushNotifications}
                      onCheckedChange={(value) => handleToggle("systemUpdates", value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyReports">
                        <div className="flex items-center">
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Weekly Reports
                        </div>
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Weekly summary reports of campaign performance
                      </p>
                    </div>
                    <Switch
                      id="weeklyReports"
                      checked={preferences.weeklyReports}
                      disabled={!preferences.pushNotifications}
                      onCheckedChange={(value) => handleToggle("weeklyReports", value)}
                    />
                  </div>
                </div>
                
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>About Notifications</AlertTitle>
                  <AlertDescription>
                    PhishNet uses notifications to keep you informed about campaign activities, 
                    security events, and system updates. Configure your preferences to ensure you 
                    receive only the notifications that matter to you.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={fetchNotificationPreferences}
              disabled={loadingPreferences}
              className="ml-auto"
            >
              {loadingPreferences && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh Settings
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
      
      <TabsContent value="email">
        <EmailSettings />
      </TabsContent>
    </Tabs>
  );
}