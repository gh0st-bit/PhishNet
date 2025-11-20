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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
}

export default function EnrollmentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBulkDialog, setShowBulkDialog] = useState(false);

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

      return apiRequest("POST", "/api/admin/enroll/invite", {
        emails: emailList,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Invites sent successfully",
        description: `${data.success?.length || 0} invitation(s) sent. ${data.failed?.length || 0} failed.`,
      });
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

  const onSubmit = (data: BulkInviteForm) => {
    sendInvites.mutate(data);
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/accept-invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Invite link copied",
      description: "The invitation link has been copied to your clipboard.",
    });
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
                          {!invite.acceptedAt && new Date(invite.expiresAt) > new Date() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInviteLink(invite.token)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
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
