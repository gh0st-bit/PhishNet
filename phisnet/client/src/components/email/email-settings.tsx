import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Check,
  Info as InfoIcon,
  Loader2,
  Clock,
  FileText,
  BarChart4
} from "lucide-react";

interface EmailPreferences {
  emailNotifications: boolean;
  weeklyReports: boolean;
  campaignResults: boolean;
  securityAlerts: boolean;
  inviteEmail: boolean;
}

export function EmailSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    emailNotifications: true,
    weeklyReports: true,
    campaignResults: true,
    securityAlerts: true,
    inviteEmail: true,
  });

  useEffect(() => {
    fetchNotificationPreferences();
  }, []);

  // Fetch notification preferences from API
  const fetchNotificationPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/preferences', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }
      
      const data = await response.json();
      
      // Map API preferences (snake_case or camelCase) to our email preferences
      setPreferences({
        emailNotifications: data.emailNotifications ?? data.email_notifications ?? true,
        weeklyReports: data.weeklyReports ?? data.weekly_reports ?? true,
        campaignResults: data.campaignAlerts ?? data.campaign_alerts ?? true,
        securityAlerts: data.securityAlerts ?? data.security_alerts ?? true,
        inviteEmail: data.inviteEmail ?? data.invite_email ?? true,
      });
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load email notification preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle settings toggle
  const handleToggle = async (setting: keyof EmailPreferences, value: boolean) => {
    try {
      const updatedPreferences = {
        ...preferences,
        [setting]: value
      };
      
      setPreferences(updatedPreferences);
      
      // If we're disabling all email notifications, update all email-related settings
      let apiPreferences = {};
      
      if (setting === 'emailNotifications' && value === false) {
        // If turning off email notifications, update the UI to reflect all email settings are off
        setPreferences({
          ...updatedPreferences,
          weeklyReports: false,
          campaignResults: false,
          securityAlerts: false,
          inviteEmail: false,
        });
        
        apiPreferences = {
          emailNotifications: false,
          // Keep push notifications unchanged
          weeklyReports: false,
          campaignAlerts: false,
          securityAlerts: false,
          inviteEmail: false,
        };
      } else {
        // Map our email preferences to API structure
        apiPreferences = {
          emailNotifications: updatedPreferences.emailNotifications,
          weeklyReports: updatedPreferences.weeklyReports,
          campaignAlerts: updatedPreferences.campaignResults,
          securityAlerts: updatedPreferences.securityAlerts,
          inviteEmail: updatedPreferences.inviteEmail,
        };
      }
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPreferences),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update email preferences');
      }
      
      toast({
        title: "Setting updated",
        description: "Your email notification preference has been saved.",
      });
    } catch (error) {
      console.error('Error updating email preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update email preference",
        variant: "destructive"
      });
      
      // Revert the UI state on error
      fetchNotificationPreferences();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notification Settings</CardTitle>
        <CardDescription>
          Manage what emails you receive from PhishNet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Notifications
                    </div>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email (master toggle)
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={preferences.emailNotifications}
                  onCheckedChange={(value) => handleToggle("emailNotifications", value)}
                />
              </div>
              
              <div className={`border-t pt-4 space-y-4 ${!preferences.emailNotifications ? 'opacity-50' : ''}`}>
                <h3 className="text-lg font-medium">Email Types</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="campaignResults">
                      <div className="flex items-center">
                        <Check className="h-4 w-4 mr-2" />
                        Campaign Results
                      </div>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications when campaigns complete or have significant activity
                    </p>
                  </div>
                  <Switch
                    id="campaignResults"
                    checked={preferences.campaignResults}
                    disabled={!preferences.emailNotifications}
                    onCheckedChange={(value) => handleToggle("campaignResults", value)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weeklyReports">
                      <div className="flex items-center">
                        <BarChart4 className="h-4 w-4 mr-2" />
                        Weekly Reports
                      </div>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive weekly summary reports of all campaign activity
                    </p>
                  </div>
                  <Switch
                    id="weeklyReports"
                    checked={preferences.weeklyReports}
                    disabled={!preferences.emailNotifications}
                    onCheckedChange={(value) => handleToggle("weeklyReports", value)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="securityAlerts">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Security Alerts
                      </div>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications for important security events
                    </p>
                  </div>
                  <Switch
                    id="securityAlerts"
                    checked={preferences.securityAlerts}
                    disabled={!preferences.emailNotifications}
                    onCheckedChange={(value) => handleToggle("securityAlerts", value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="inviteEmail">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        Invite Acceptance
                      </div>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive an email when a user accepts an invitation
                    </p>
                  </div>
                  <Switch
                    id="inviteEmail"
                    checked={preferences.inviteEmail}
                    disabled={!preferences.emailNotifications}
                    onCheckedChange={(value) => handleToggle("inviteEmail", value)}
                  />
                </div>
              </div>
            </div>
            
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>About Email Notifications</AlertTitle>
              <AlertDescription>
                These settings only control emails sent directly by PhishNet. Campaign-related emails like phishing 
                templates will still be sent as part of your campaigns. This only controls notification emails.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          onClick={fetchNotificationPreferences}
          disabled={loading}
          className="ml-auto"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Refresh Settings
        </Button>
      </CardFooter>
    </Card>
  );
}