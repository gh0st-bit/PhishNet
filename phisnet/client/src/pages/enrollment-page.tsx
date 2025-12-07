import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  UserPlus,
  Copy,
  RefreshCw,
  MoreVertical,
  Trash,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { customToast } from "@/components/ui/custom-toast";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const bulkInviteSchema = z.object({
  emails: z.string().min(1, "Please enter at least one email address"),
});

type BulkInviteForm = z.infer<typeof bulkInviteSchema>;

interface UserInvite {
  id: number;
  email: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedByUserId: number;
  inviteUrl?: string;
}

export default function EnrollmentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);

  const form = useForm<BulkInviteForm>({
    resolver: zodResolver(bulkInviteSchema),
    defaultValues: {
      emails: "",
    },
  });

  // Fetch invites
  const { data: invites, isLoading } = useQuery<UserInvite[]>({
    queryKey: ["/api/admin/enroll/invites"],
  });

  // Send invites mutation
  const sendInvites = useMutation({
    mutationFn: async (data: BulkInviteForm) => {
      const emailList = data.emails
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const response = await apiRequest("POST", "/api/admin/enroll/invite", {
        emails: emailList,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Invite response:", data);
      
      const successCount = data.successCount ?? data.success?.length ?? 0;
      const failedCount = data.failedCount ?? data.failed?.length ?? 0;
      
      console.log("Success count:", successCount, "Failed count:", failedCount);
      
      if (failedCount > 0) {
        customToast.error({
          title: "Invites partially sent",
          description: `${successCount} invitation(s) sent successfully, ${failedCount} failed.`,
        });
      } else {
        customToast.success({
          title: "Invites sent successfully",
          description: `${successCount} invitation(s) sent to employees.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enroll/invites"] });
      setShowBulkDialog(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to send invites",
        description: error.message,
      });
    },
  });

  // Delete invite mutation
  const deleteInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      return apiRequest("DELETE", `/api/admin/enroll/invites/${inviteId}`);
    },
    onSuccess: () => {
      customToast.success({ title: "Invite deleted successfully", description: "The invitation has been revoked." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enroll/invites"] });
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to delete invite", description: error.message });
    },
  });

  // Resend invite mutation
  const resendInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      return apiRequest("POST", `/api/admin/enroll/invites/${inviteId}/resend`);
    },
    onSuccess: (data) => {
      customToast.success({ title: "Invite resent successfully", description: "A new invitation email has been sent." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enroll/invites"] });
      // Optionally copy new invite URL
      if (data.inviteUrl) {
        navigator.clipboard.writeText(data.inviteUrl);
        customToast.info({ title: "New invite link copied to clipboard" });
      }
    },
    onError: (error: Error) => {
      customToast.error({ title: "Failed to resend invite", description: error.message });
    },
  });

  const onSubmit = (data: BulkInviteForm) => {
    sendInvites.mutate(data);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      customToast.error({ title: "Invalid file type", description: "Please upload a CSV file" });
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const emails: string[] = [];
      
      // Parse CSV - handle both comma and newline separated
      const lines = text.split(/\r?\n/);
      
      lines.forEach((line) => {
        // Split by comma for CSV columns
        const columns = line.split(',');
        
        columns.forEach((col) => {
          const trimmed = col.trim().replace(/["']/g, '');
          // Basic email validation regex
          if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            emails.push(trimmed.toLowerCase());
          }
        });
      });
      
      // Remove duplicates
      const uniqueEmails = Array.from(new Set(emails));
      setParsedEmails(uniqueEmails);
      
      // Update form with parsed emails
      form.setValue('emails', uniqueEmails.join('\n'));
      
      customToast.success({ 
        title: "CSV parsed successfully", 
        description: `Found ${uniqueEmails.length} unique email(s)` 
      });
    };
    
    reader.onerror = () => {
      customToast.error({ title: "Failed to read file", description: "Could not parse the CSV file" });
    };
    
    reader.readAsText(file);
  };

  const clearCsvUpload = () => {
    setCsvFile(null);
    setParsedEmails([]);
    form.setValue('emails', '');
  };

  const copyInviteLink = (invite: UserInvite) => {
    const inviteUrl = invite.inviteUrl || `${window.location.origin}/api/enroll/accept?token=${encodeURIComponent(invite.token)}`;
    navigator.clipboard.writeText(inviteUrl);
    customToast.success({ title: "Invite link copied", description: "The invitation link has been copied to your clipboard." });
  };

  const getStatusBadge = (invite: UserInvite) => {
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
    <AppLayout title="Employee Enrollment">
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Employee Enrollment
                </CardTitle>
                <CardDescription>
                  Invite employees to join your organization's phishing awareness program
                </CardDescription>
              </div>
              <Button onClick={() => setShowBulkDialog(true)}>
                <Send className="mr-2 h-4 w-4" />
                Send Invites
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invites</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invites?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {invites?.filter((inv) => !inv.acceptedAt && new Date(inv.expiresAt) > new Date()).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {invites?.filter((inv) => inv.acceptedAt).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invites Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invitation Status</CardTitle>
            <CardDescription>
              View and manage employee invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : invites && invites.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>{getStatusBadge(invite)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(invite.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(invite.expiresAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invite.acceptedAt ? formatDate(invite.acceptedAt) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!invite.acceptedAt && new Date(invite.expiresAt) > new Date() && (
                                <DropdownMenuItem onClick={() => copyInviteLink(invite)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Link
                                </DropdownMenuItem>
                              )}
                              {!invite.acceptedAt && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => resendInvite.mutate(invite.id)}
                                    disabled={resendInvite.isPending}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Resend
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => deleteInvite.mutate(invite.id)}
                                    disabled={deleteInvite.isPending}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                              {invite.acceptedAt && (
                                <DropdownMenuItem disabled>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Accepted
                                </DropdownMenuItem>
                              )}
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
                <p>No invitations sent yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowBulkDialog(true)}
                >
                  Send First Invite
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Invite Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Enrollment Invitations</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* CSV Upload Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload CSV File (Optional)</label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  {csvFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearCsvUpload}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {csvFile && parsedEmails.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <Upload className="inline h-3 w-3 mr-1" />
                    Loaded: {csvFile.name} ({parsedEmails.length} email(s))
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  CSV should contain email addresses. Supports multiple columns and rows.
                </p>
              </div>
              <FormField
                control={form.control}
                name="emails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Addresses</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter email addresses (one per line, or comma/semicolon separated)&#10;employee1@example.com&#10;employee2@example.com&#10;employee3@example.com"
                        className="min-h-[200px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter one email per line, or separate multiple emails with commas or semicolons
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBulkDialog(false)}
                >
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
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
