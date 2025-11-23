import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { Loader2, UsersRound, Lock, Building, Users, UserCheck, Shield, X, ArrowLeft } from "lucide-react";
import { TwoFactorSetupDialog } from '@/components/security/two-factor-setup-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { customToast } from '@/components/ui/custom-toast';
import { useLocation } from "wouter";


export default function OrganizationPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const orgName = user?.organizationName;

  // Fetch users in organization
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Generate organization initials
  const orgInitials = orgName
    ? orgName
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  // Generate user initials
  const getUserInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`;
  };

  // Format membership date
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  // Handle close/back navigation
  const handleClose = () => {
    navigate("/");
  };

  return (
    <div className="container max-w-5xl py-6 mx-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-center">Organization</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Organization Overview Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Your organization information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-24 w-24 mb-3">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {orgInitials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-semibold">{orgName}</h2>
              <Badge variant="outline" className="mt-1">
                {user?.isAdmin ? "Administrator" : "Member"}
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Member Since
                </div>
                <div className="text-sm">
                  {formatDate(user?.createdAt)}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Organization ID
                </div>
                <div className="text-sm">
                  {user?.organizationId}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Your Role
                </div>
                <div className="text-sm flex items-center">
                  {user?.isAdmin ? (
                    <>
                      <Shield className="h-4 w-4 mr-1 text-primary" />
                      Administrator
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-1 text-muted-foreground" />
                      Standard User
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Members Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              People with access to {orgName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="members">
              <TabsList className="mb-4">
                <TabsTrigger value="members">
                  <Users className="h-4 w-4 mr-2" />
                  All Members
                </TabsTrigger>
                <TabsTrigger value="admins">
                  <Shield className="h-4 w-4 mr-2" />
                  Administrators
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users?.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div className="flex items-center">
                          <Avatar className="h-9 w-9 mr-3">
                            <AvatarImage
                              src={member.profilePicture || undefined}
                              alt={`${member.firstName} ${member.lastName}`}
                            />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {getUserInitials(member.firstName, member.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {member.isAdmin && (
                            <Badge variant="secondary" className="mr-2">
                              Admin
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Joined {formatDate(member.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="admins">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users
                      ?.filter((member) => member.isAdmin)
                      .map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 border rounded-md"
                        >
                          <div className="flex items-center">
                            <Avatar className="h-9 w-9 mr-3">
                              <AvatarImage
                                src={member.profilePicture || undefined}
                                alt={`${member.firstName} ${member.lastName}`}
                              />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getUserInitials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Badge variant="secondary" className="mr-2">
                              Admin
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              Joined {formatDate(member.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Organization Security Card */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Security and Access</CardTitle>
            <CardDescription>
              Manage security settings for your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TwoFactorSection user={user} />

            <div className="flex items-center justify-between p-4 border rounded-md mb-4 bg-card/50">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Organization Name</div>
                  <div className="text-sm text-muted-foreground max-w-lg">
                    Change your organization name and settings.
                  </div>
                </div>
              </div>
              <ManageOrganizationButton disabled={!user?.isAdmin} currentName={orgName || ''} />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-md bg-card/50">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  <UsersRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">User Invitations</div>
                  <div className="text-sm text-muted-foreground max-w-lg">
                    Invite new users to join your organization.
                  </div>
                </div>
              </div>
              <Button variant="outline" disabled={!user?.isAdmin}>
                Invite Users
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 2FA section component
const TwoFactorSection: React.FC<{ user: any }> = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const isAdmin = !!user?.isAdmin;

  async function fetchStatus() {
    if (!isAdmin) return;
    try {
      const res = await apiRequest('GET', '/api/user/2fa/status');
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
      }
    } catch {/* ignore */}
  }

  useEffect(() => { fetchStatus(); }, []);

  function handleComplete() {
    fetchStatus();
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-md mb-4 bg-card/50">
      <div className="flex items-start space-x-3">
        <div className="mt-0.5">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-medium flex items-center gap-2">
            Two-Factor Authentication
            {enabled !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${enabled ? 'bg-green-500/10 text-green-600 border-green-500/40' : 'bg-yellow-500/10 text-yellow-700 border-yellow-500/40'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground max-w-lg">
            Add an extra layer of security to your account by requiring a one-time code in addition to your password when you sign in.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={!isAdmin} onClick={() => setOpen(true)}>
          {enabled ? 'Reconfigure' : 'Configure'}
        </Button>
        {enabled && (
          <Button variant="destructive" disabled={!isAdmin} onClick={() => setDisableOpen(true)}>
            Disable
          </Button>
        )}
      </div>
      <TwoFactorSetupDialog open={open} onOpenChange={setOpen} onComplete={handleComplete} />
      {enabled && (
        <DisableTwoFactorDialog
          open={disableOpen}
          onOpenChange={setDisableOpen}
          onDisabled={() => { setDisableOpen(false); handleComplete(); }}
        />
      )}
    </div>
  );
};

// Manage Organization dialog/button component
// Disable 2FA dialog component (placed above for clarity)
const DisableTwoFactorDialog: React.FC<{ open: boolean; onOpenChange: (v:boolean)=>void; onDisabled: ()=>void }> = ({ open, onOpenChange, onDisabled }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function handleDisable() {
    setError(null); setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/user/2fa/disable', { password });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) {
        setError(body.message || 'Failed to disable 2FA');
        customToast.error({ title: 'Disable Failed', description: body.message || 'Invalid password or server error' });
      } else {
        customToast.success({ title: 'Two-Factor Disabled', description: '2FA removed. You can re-enable it anytime.' });
        setPassword('');
        onDisabled();
      }
    } catch (e:any) {
      setError(e.message || 'Unexpected error');
      customToast.error({ title: 'Disable Failed', description: e.message || 'Unexpected error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if(!loading) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            This will stop requiring a one-time code at login and clears your backup codes. To enable again, choose Configure later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Confirm Password</label>
            <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} placeholder="Enter current password" />
            <p className="text-xs text-muted-foreground mt-1">Required for security confirmation.</p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleDisable} disabled={loading || password.length < 6}>{loading ? 'Disabling…' : 'Disable 2FA'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ManageOrganizationButton: React.FC<{ disabled: boolean; currentName: string }> = ({ disabled, currentName }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { setName(currentName); }, [currentName]);

  async function handleSave() {
    setError(null); setSuccess(false); setSaving(true);
    try {
      const res = await apiRequest('PUT', '/api/organization/name', { name });
      if (!res.ok) {
        const data = await res.json().catch(()=>({message:'Failed'}));
        setError(data.message || 'Update failed');
      } else {
        setSuccess(true);
        // Force refresh of user/org display (simple approach)
        setTimeout(() => { window.location.reload(); }, 700);
      }
    } catch (e:any) {
      setError(e.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>Manage</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Organization Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} disabled={saving} placeholder="Enter organization name" />
              <p className="text-xs text-muted-foreground mt-1">2–100 characters. Changes propagate to all users.</p>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-600">Name updated. Refreshing…</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || name.trim().length < 2}> {saving ? 'Saving…' : 'Save'} </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};