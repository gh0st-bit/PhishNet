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
    if (typeof globalThis !== 'undefined' && (globalThis as any).location) {
      const params = new URLSearchParams(globalThis.location.search);
      const tab = params.get('tab');
      if (tab === 'notifications' || tab === 'appearance' || tab === 'account' || tab === 'governance') {
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
      setSessionTimeout(Number.parseInt(savedTimeout));
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
  // (legacy) handleSaveSettings removed; per-section save handlers inline
  
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
          {user?.isAdmin && (
            <TabsTrigger value="governance">
              <BarChart3 className="h-4 w-4 mr-2" />
              Governance
            </TabsTrigger>
          )}
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
                      onChange={(e) => handleSessionTimeoutChange(Number.parseInt(e.target.value))}
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

        {/* Governance Tab (Admin only) */}
        {user?.isAdmin && (
          <TabsContent value="governance">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Retention Policy</CardTitle>
                  <CardDescription>
                    Control how long to retain audit logs, notifications, and submitted data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RetentionPolicyForm />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Single Sign-On (SSO)</CardTitle>
                  <CardDescription>
                    Configure SAML or OIDC for enterprise authentication.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SsoConfigForm />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Secrets Management</CardTitle>
                  <CardDescription>
                    View encryption key status and manage secrets security.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SecretsManagementPanel />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function RetentionPolicyForm() {
  const { toast } = useToast();
  const [days, setDays] = useState<number>(365);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [lastStatus, setLastStatus] = useState<{ lastRunAt: string | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [policyRes, statusRes] = await Promise.all([
          fetch('/api/data-retention/policy', { credentials: 'include' }),
          fetch('/api/data-retention/status', { credentials: 'include' }),
        ]);
        if (policyRes.ok) {
          const p = await policyRes.json();
          if (mounted && typeof p.dataRetentionDays === 'number') setDays(p.dataRetentionDays);
        }
        if (statusRes.ok) {
          const s = await statusRes.json();
          if (mounted) setLastStatus({ lastRunAt: s?.scheduler?.lastRunAt || null });
        }
      } catch (e: any) {
        console.error('Failed to load retention policy/status', e);
        toast({
          title: 'Could not load data retention info',
          description: e?.message || 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/data-retention/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to update policy');
      toast({ title: 'Retention policy updated', description: `Now ${days} day(s)` });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setRunning(true);
      const res = await fetch('/api/data-retention/run-now', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to run cleanup');
      setLastStatus({ lastRunAt: new Date().toISOString() });
      const total = (json.summary?.perOrganization || []).reduce((acc: number, o: any) => acc + (o.deletedAuditLogs || 0) + (o.deletedNotifications || 0) + (o.clearedSubmittedData || 0), 0);
      toast({ title: 'Cleanup complete', description: `Processed ${total} item(s)` });
    } catch (e: any) {
      toast({ title: 'Cleanup failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="retentionDays">Retention Days</Label>
          <Input
            id="retentionDays"
            type="number"
            min={0}
            max={3650}
            value={days}
            onChange={(e) => setDays(Math.max(0, Math.min(3650, Number(e.target.value || 0))))}
            disabled={loading}
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground mt-1">0 = keep only current-day data; typical is 180–730.</p>
        </div>
        <Button onClick={save} disabled={loading || saving} variant="default">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save
        </Button>
        <Button onClick={runNow} disabled={loading || running} variant="outline">
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Run Cleanup Now
        </Button>
      </div>
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <InfoIcon className="h-4 w-4" />
        Last run: {lastStatus?.lastRunAt ? new Date(lastStatus.lastRunAt).toLocaleString() : 'never'}
      </div>
    </div>
  );
}

function SsoConfigForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    provider: 'saml' as 'saml' | 'oidc',
    entityId: '',
    ssoUrl: '',
    certificate: '',
    issuer: '',
    clientId: '',
    clientSecret: '',
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/sso/config', { credentials: 'include' });
        const data = await res.json();
        if (mounted && data) {
          setConfig((prev) => ({ ...prev, ...data }));
        }
      } catch (e: unknown) {
        toast({ title: 'Failed to load SSO config', variant: 'destructive' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/sso/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to update SSO config');
      toast({ title: 'SSO configuration saved', description: 'Changes will take effect on next login' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading SSO config...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Enable SSO</Label>
          <p className="text-xs text-muted-foreground">Allow users to log in via SAML or OIDC</p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => setConfig((prev) => ({ ...prev, enabled }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Provider Type</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={config.provider}
          onChange={(e) => setConfig((prev) => ({ ...prev, provider: e.target.value as 'saml' | 'oidc' }))}
        >
          <option value="saml">SAML 2.0</option>
          <option value="oidc">OpenID Connect (OIDC)</option>
        </select>
      </div>

      {config.provider === 'saml' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="entityId">Entity ID (SP)</Label>
            <Input
              id="entityId"
              value={config.entityId}
              onChange={(e) => setConfig((prev) => ({ ...prev, entityId: e.target.value }))}
              placeholder="https://yourapp.com/saml/metadata"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssoUrl">SSO URL (IdP)</Label>
            <Input
              id="ssoUrl"
              value={config.ssoUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, ssoUrl: e.target.value }))}
              placeholder="https://idp.example.com/sso/saml"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="certificate">IdP x509 Certificate</Label>
            <textarea
              id="certificate"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={config.certificate}
              onChange={(e) => setConfig((prev) => ({ ...prev, certificate: e.target.value }))}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            />
            <p className="text-xs text-muted-foreground">Paste the full x509 certificate from your IdP</p>
          </div>
        </>
      )}

      {config.provider === 'oidc' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="issuer">Issuer URL</Label>
            <Input
              id="issuer"
              value={config.issuer}
              onChange={(e) => setConfig((prev) => ({ ...prev, issuer: e.target.value }))}
              placeholder="https://accounts.example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              value={config.clientId}
              onChange={(e) => setConfig((prev) => ({ ...prev, clientId: e.target.value }))}
              placeholder="your-client-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={config.clientSecret}
              onChange={(e) => setConfig((prev) => ({ ...prev, clientSecret: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
        </>
      )}

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Save SSO Configuration
      </Button>
    </div>
  );
}

function SecretsManagementPanel() {
  const { toast } = useToast();
  const [encryptionStatus, setEncryptionStatus] = useState<{
    hasKey: boolean;
    lastRotation?: string;
  }>({ hasKey: false });
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    loadEncryptionStatus();
  }, []);

  const loadEncryptionStatus = async () => {
    try {
      const res = await fetch('/api/secrets/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEncryptionStatus(data);
      }
    } catch (e: any) {
      console.error('Failed to load encryption status:', e);
    } finally {
      setLoading(false);
    }
  };

  const rotateKey = async () => {
    if (!confirm('Rotating encryption keys will re-encrypt all sensitive data. This operation may take some time. Continue?')) {
      return;
    }

    try {
      setRotating(true);
      const res = await fetch('/api/secrets/rotate', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to rotate encryption key');
      }

      toast({
        title: 'Key Rotation Complete',
        description: 'All sensitive data has been re-encrypted with the new key.',
      });

      await loadEncryptionStatus();
    } catch (e: any) {
      toast({
        title: 'Key Rotation Failed',
        description: e.message || 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setRotating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Encryption Status</AlertTitle>
        <AlertDescription>
          {encryptionStatus.hasKey
            ? 'Organization encryption key is active. SMTP passwords and SSO secrets are encrypted at rest.'
            : 'No encryption key found. Sensitive data may not be encrypted.'}
        </AlertDescription>
      </Alert>

      {encryptionStatus.lastRotation && (
        <div className="text-sm text-muted-foreground">
          Last key rotation: {new Date(encryptionStatus.lastRotation).toLocaleString()}
        </div>
      )}

      <div className="space-y-2">
        <Label>Key Management</Label>
        <div className="flex items-center space-x-2">
          <Button
            onClick={rotateKey}
            disabled={rotating || !encryptionStatus.hasKey}
            variant="outline"
          >
            {rotating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Rotate Encryption Key
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Key rotation re-encrypts all sensitive data with a new key. This improves security but may take time.
        </p>
      </div>

      <Alert variant="default">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Security Best Practices</AlertTitle>
        <AlertDescription className="space-y-2">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Rotate encryption keys every 90 days</li>
            <li>Never share MASTER_ENCRYPTION_KEY</li>
            <li>Store master key in secure vault service</li>
            <li>Use different keys for dev/staging/production</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
