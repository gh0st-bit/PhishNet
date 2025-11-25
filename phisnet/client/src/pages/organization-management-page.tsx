import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Plus,
  Edit,
  Trash,
  Mail,
  Send,
  Clock,
  CheckCircle,
  Loader2,
  UserPlus,
  Copy,
  RefreshCw,
  MoreVertical,
  Shield,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { customToast } from "@/components/ui/custom-toast";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Schemas
const orgSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  dataRetentionDays: z.number().int().min(1).max(3650).optional(),
  twoFactorRequired: z.boolean().optional(),
});

const orgAdminInviteSchema = z.object({
  emails: z.string().min(1, "Please enter at least one email address"),
});

type OrgForm = z.infer<typeof orgSchema>;
type OrgAdminInviteForm = z.infer<typeof orgAdminInviteSchema>;

interface Organization {
  id: number;
  name: string;
  dataRetentionDays: number | null;
  twoFactorRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrgAdminInvite {
  id: number;
  email: string;
  organizationId: number;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  inviteUrl?: string;
  roleType?: string;
}

interface OrgAdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: number;
  organizationName: string;
  isActive: boolean;
  createdAt: string;
}

export default function OrganizationManagementPage() {
  const queryClient = useQueryClient();
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteOrgId, setDeleteOrgId] = useState<number | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const orgForm = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: "",
      dataRetentionDays: 90,
      twoFactorRequired: false,
    },
  });

  const inviteForm = useForm<OrgAdminInviteForm>({
    resolver: zodResolver(orgAdminInviteSchema),
    defaultValues: {
      emails: "",
    },
  });

  // Fetch organizations (admin only endpoint - to be created)
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  // Fetch org-admin invites
  const { data: invites, isLoading: invitesLoading } = useQuery<OrgAdminInvite[]>({
    queryKey: ["/api/admin/org-admin-invites"],
  });

  // Fetch accepted org-admin users
  const { data: orgAdminUsers, isLoading: orgAdminsLoading } = useQuery<OrgAdminUser[]>({
    queryKey: ["/api/admin/org-admins"],
  });

  // Create organization mutation
  const createOrg = useMutation({
    mutationFn: async (data: OrgForm) => {
      return apiRequest("POST", "/api/admin/organizations", data);
    },
    onSuccess: () => {
      customToast.success({ title: "Organization created", description: "New organization has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      setShowOrgDialog(false);
      orgForm.reset();
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to create organization", description: error.message });
    },
  });

  // Update organization mutation
  const updateOrg = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<OrgForm> }) => {
      return apiRequest("PUT", `/api/admin/organizations/${id}`, data);
    },
    onSuccess: () => {
      customToast.success({ title: "Organization updated", description: "Organization has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      setShowOrgDialog(false);
      setEditingOrg(null);
      orgForm.reset();
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to update organization", description: error.message });
    },
  });

  // Delete organization mutation
  const deleteOrg = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/organizations/${id}`);
    },
    onSuccess: () => {
      customToast.success({ title: "Organization deleted", description: "Organization has been deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      setDeleteOrgId(null);
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to delete organization", description: error.message });
    },
  });

  // Send org-admin invites mutation
  const sendInvites = useMutation({
    mutationFn: async (data: OrgAdminInviteForm) => {
      const emailList = data.emails
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const response = await apiRequest("POST", `/api/admin/organizations/${selectedOrgId}/invite-admin`, {
        emails: emailList,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const successCount = data.successCount ?? data.success?.length ?? 0;
      const failedCount = data.failedCount ?? data.failed?.length ?? 0;
      
      if (failedCount > 0) {
        customToast.error({
          title: "Invites partially sent",
          description: `${successCount} invitation(s) sent, ${failedCount} failed.`,
        });
      } else {
        customToast.success({
          title: "Invites sent successfully",
          description: `${successCount} org admin invitation(s) sent.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-admin-invites"] });
      setShowInviteDialog(false);
      inviteForm.reset();
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to send invites", description: error.message });
    },
  });

  // Delete invite mutation
  const deleteInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      return apiRequest("DELETE", `/api/admin/org-admin-invites/${inviteId}`);
    },
    onSuccess: () => {
      customToast.success({ title: "Invite deleted", description: "The invitation has been revoked." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-admin-invites"] });
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to delete invite", description: error.message });
    },
  });

  // Resend invite mutation
  const resendInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      return apiRequest("POST", `/api/admin/org-admin-invites/${inviteId}/resend`);
    },
    onSuccess: (data) => {
      customToast.success({ title: "Invite resent", description: "A new invitation email has been sent." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-admin-invites"] });
      if (data.inviteUrl) {
        navigator.clipboard.writeText(data.inviteUrl);
        customToast.info({ title: "New invite link copied" });
      }
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to resend invite", description: error.message });
    },
  });

  // Delete org admin user mutation
  const deleteOrgAdmin = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/admin/org-admins/${userId}`);
    },
    onSuccess: () => {
      customToast.success({ title: "Org Admin deleted", description: "The org admin user has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/org-admins"] });
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to delete org admin", description: error.message });
    },
  });

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    orgForm.reset({
      name: org.name,
      dataRetentionDays: org.dataRetentionDays ?? 90,
      twoFactorRequired: org.twoFactorRequired,
    });
    setShowOrgDialog(true);
  };

  const handleOrgSubmit = (data: OrgForm) => {
    if (editingOrg) {
      updateOrg.mutate({ id: editingOrg.id, data });
    } else {
      createOrg.mutate(data);
    }
  };

  const copyInviteLink = (invite: OrgAdminInvite) => {
    const inviteUrl = invite.inviteUrl || `${window.location.origin}/api/enroll/accept?token=${encodeURIComponent(invite.token)}`;
    navigator.clipboard.writeText(inviteUrl);
    customToast.success({ title: "Invite link copied" });
  };

  const getStatusBadge = (invite: OrgAdminInvite) => {
    const now = new Date();
    const expiresAt = new Date(invite.expiresAt);
    
    if (invite.acceptedAt) {
      return <Badge className="bg-green-500">Accepted</Badge>;
    } else if (now > expiresAt) {
      return <Badge variant="destructive">Expired</Badge>;
    } else {
      return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout title="Organization Management">
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization Management
                </CardTitle>
                <CardDescription>
                  Manage organizations, settings, and organization administrators
                </CardDescription>
              </div>
              <Button onClick={() => { setEditingOrg(null); orgForm.reset(); setShowOrgDialog(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Organization
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="organizations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="admins">Invites</TabsTrigger>
            <TabsTrigger value="active-admins">Active Org Admins</TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organizations</CardTitle>
                <CardDescription>View and manage all organizations</CardDescription>
              </CardHeader>
              <CardContent>
                {orgsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : organizations && organizations.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization Name</TableHead>
                          <TableHead>Data Retention</TableHead>
                          <TableHead>2FA Required</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {organizations.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell>{org.dataRetentionDays ? `${org.dataRetentionDays} days` : "Not set"}</TableCell>
                            <TableCell>
                              {org.twoFactorRequired ? (
                                <Badge className="bg-green-500">Required</Badge>
                              ) : (
                                <Badge variant="secondary">Optional</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(org.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditOrg(org)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedOrgId(org.id); setShowInviteDialog(true); }}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Invite Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteOrgId(org.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>No organizations yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowOrgDialog(true)}
                    >
                      Create First Organization
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization Admins Tab */}
          <TabsContent value="admins" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Organization Administrator Invitations</CardTitle>
                    <CardDescription>
                      View and manage all organization admin invites (pending, accepted, and expired)
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => {
                      if (!selectedOrgId && organizations && organizations.length > 0) {
                        setSelectedOrgId(organizations[0].id);
                      }
                      setShowInviteDialog(true);
                    }}
                    disabled={!organizations || organizations.length === 0}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Invites
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {invitesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : invites && invites.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invites.map((invite) => (
                          <TableRow key={invite.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {invite.email}
                                <Badge variant="outline" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Org Admin
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {organizations?.find(o => o.id === invite.organizationId)?.name || "Unknown"}
                            </TableCell>
                            <TableCell>{getStatusBadge(invite)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(invite.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(invite.expiresAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem disabled>
                                    <Clock className="mr-2 h-4 w-4" />
                                    {invite.acceptedAt
                                      ? `Accepted on ${formatDate(invite.acceptedAt)}`
                                      : new Date(invite.expiresAt) < new Date()
                                        ? `Expired on ${formatDate(invite.expiresAt)}`
                                        : `Expires on ${formatDate(invite.expiresAt)}`}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />

                                  {/* Always allow copying the invite link while it exists */}
                                  <DropdownMenuItem onClick={() => copyInviteLink(invite)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy Invite Link
                                  </DropdownMenuItem>

                                  {/* Resend only for pending + not expired */}
                                  {!invite.acceptedAt && new Date(invite.expiresAt) > new Date() && (
                                    <DropdownMenuItem
                                      onClick={() => resendInvite.mutate(invite.id)}
                                      disabled={resendInvite.isPending}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Resend Email
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />

                                  {/* Delete available for any invite */}
                                  <DropdownMenuItem
                                    onClick={() => deleteInvite.mutate(invite.id)}
                                    disabled={deleteInvite.isPending}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete Invite
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>No organization admin invitations yet</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowInviteDialog(true)}
                      disabled={!organizations || organizations.length === 0}
                    >
                      Send First Invite
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Org Admins Tab */}
          <TabsContent value="active-admins" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Organization Administrators</CardTitle>
                <CardDescription>View and manage users with Organization Admin access</CardDescription>
              </CardHeader>
              <CardContent>
                {orgAdminsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : orgAdminUsers && orgAdminUsers.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgAdminUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {user.email}
                                <Badge variant="outline" className="text-xs">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Org Admin
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{user.organizationName || "Unknown"}</TableCell>
                            <TableCell>
                              {user.isActive ? (
                                <Badge className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(user.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Organization Administrator?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove <strong>{user.firstName} {user.lastName}</strong> ({user.email})
                                      as an organization administrator? This will permanently delete their account and revoke all access.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteOrgAdmin.mutate(user.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>No active organization administrators</p>
                    <p className="text-sm mt-1">Invite org admins from the Organizations tab</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Organization Dialog */}
      <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? "Edit Organization" : "Create Organization"}</DialogTitle>
            <DialogDescription>
              {editingOrg ? "Update organization settings" : "Add a new organization to the system"}
            </DialogDescription>
          </DialogHeader>
          <Form {...orgForm}>
            <form onSubmit={orgForm.handleSubmit(handleOrgSubmit)} className="space-y-4">
              <FormField
                control={orgForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orgForm.control}
                name="dataRetentionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Retention (Days)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="90" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of days to retain campaign data (1-3650)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orgForm.control}
                name="twoFactorRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Require Two-Factor Authentication</FormLabel>
                      <FormDescription>
                        Force all users to enable 2FA
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowOrgDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>
                  {(createOrg.isPending || updateOrg.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingOrg ? "Update" : "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Invite Org Admin Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Invite Organization Administrator</DialogTitle>
            <DialogDescription>
              Send invitation to organization-level admin(s)
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit((data) => sendInvites.mutate(data))} className="space-y-4">
              {organizations && organizations.length > 1 && (
                <div>
                  <label className="text-sm font-medium">Organization</label>
                  <select
                    className="w-full mt-1 p-2 border rounded-md"
                    value={selectedOrgId || ""}
                    onChange={(e) => setSelectedOrgId(parseInt(e.target.value))}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <FormField
                control={inviteForm.control}
                name="emails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Addresses</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="orgadmin@example.com&#10;admin2@example.com"
                        className="min-h-[150px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter one email per line, or separate with commas/semicolons
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sendInvites.isPending}>
                  {sendInvites.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Invites
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Confirmation */}
      <AlertDialog open={deleteOrgId !== null} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the organization and all associated data including campaigns, templates, and users. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOrgId && deleteOrg.mutate(deleteOrgId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
