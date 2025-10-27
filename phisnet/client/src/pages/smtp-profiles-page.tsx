import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSmtpProfiles } from "@/hooks/useApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Send, Loader2, HelpCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const smtpProfileSchema = z.object({
  name: z.string().min(1, "Profile name is required"),
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().int().min(1, "Port must be a positive number"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  fromName: z.string().min(1, "From name is required"),
  fromEmail: z.string().email("Please enter a valid email address"),
});

type SmtpProfileFormValues = z.infer<typeof smtpProfileSchema>;

export default function SmtpProfilesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<any>(null);
  
  const { data: profiles = [], isLoading } = useSmtpProfiles();

  const form = useForm<SmtpProfileFormValues>({
    resolver: zodResolver(smtpProfileSchema),
    defaultValues: {
      name: "",
      host: "",
      port: 587,
      username: "",
      password: "",
      fromName: "",
      fromEmail: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SmtpProfileFormValues) => {
      const res = await apiRequest("POST", "/api/smtp-profiles", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "SMTP Profile created",
        description: "Your SMTP profile has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/smtp-profiles'] });
      setIsCreating(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error creating SMTP profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSmtpMutation = useMutation({
    mutationFn: async (profileId: number) => {
      const response = await apiRequest('DELETE', `/api/smtp-profiles/${profileId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete SMTP profile');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "SMTP Profile deleted",
        description: "The SMTP profile has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/smtp-profiles'] });
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting profile",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  function onSubmit(data: SmtpProfileFormValues) {
    createMutation.mutate(data);
  }

  const handleCreateProfile = () => {
    setSelectedProfile(null);
    form.reset({
      name: "",
      host: "",
      port: 587,
      username: "",
      password: "",
      fromName: "",
      fromEmail: "",
    });
    setIsCreating(true);
  };

  const handleEditProfile = (profile: any) => {
    setSelectedProfile(profile);
    form.reset({
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      password: profile.password,
      fromName: profile.fromName,
      fromEmail: profile.fromEmail,
    });
    setIsCreating(true);
  };

  const openDeleteDialog = (profile: any) => {
    setProfileToDelete(profile);
    setDeleteDialogOpen(true);
  };

  // Add this helper component
  const FieldWithHelp = ({ label, help, children }: { label: string; help: string; children: React.ReactNode }) => (
    <FormItem>
      <FormLabel className="flex items-center gap-2">
        {label}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{help}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </FormLabel>
      <FormControl>
        {children}
      </FormControl>
      <FormMessage />
    </FormItem>
  );

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">SMTP Profiles</h1>
        <Button onClick={handleCreateProfile}>
          <Plus className="mr-2 h-4 w-4" /> Create SMTP Profile
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Email Sending Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : profiles && profiles.length > 0 ? (
                profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>
                      {profile.host}:{profile.port}
                    </TableCell>
                    <TableCell>{profile.username}</TableCell>
                    <TableCell>
                      {profile.fromName} <span className="text-muted-foreground">&lt;{profile.fromEmail}&gt;</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditProfile(profile)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(profile)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No SMTP profiles found. Create your first sending profile.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit SMTP Profile Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProfile ? "Edit SMTP Profile" : "Create SMTP Profile"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Company SMTP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FieldWithHelp 
                      label="SMTP Host" 
                      help="The server address of your email provider (e.g., smtp.gmail.com, smtp.outlook.com)"
                    >
                      <Input placeholder="smtp.gmail.com" {...field} />
                    </FieldWithHelp>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="587"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender Name</FormLabel>
                      <FormControl>
                        <Input placeholder="IT Support" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fromEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="support@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {selectedProfile ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {selectedProfile ? "Update Profile" : "Create Profile"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMTP Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{profileToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteSmtpMutation.mutate(profileToDelete?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSmtpMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Profile"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
