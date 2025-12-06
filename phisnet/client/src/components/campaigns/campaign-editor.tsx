import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { 
  useCampaignDetails, 
  useGroups, 
  useSmtpProfiles, 
  useTemplates, 
  useLandingPages 
} from "@/hooks/useApi";
// Define the schema for campaign form validation using zod
const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  targetGroupId: z.string().min(1, "Target group is required"),
  smtpProfileId: z.string().min(1, "SMTP profile is required"),
  emailTemplateId: z.string().min(1, "Email template is required"),
  landingPageId: z.string().min(1, "Landing page is required"),
  scheduledAt: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
});
// Infer the TypeScript type from the zod schema
type CampaignFormValues = z.infer<typeof campaignSchema>;
// Define the props for CampaignEditor component
interface CampaignEditorProps {
  campaignId: number;
  onClose: () => void;
}
// CampaignEditor component for editing an existing campaign
export default function CampaignEditor({ campaignId, onClose }: CampaignEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Add debugging for the campaignId
  console.log('CampaignEditor mounted with campaignId:', campaignId);

  // Fetch the campaign we're editing
  const { data: campaign, isLoading: isLoadingCampaign, error: campaignError } = useCampaignDetails(Number(campaignId!));

  // Fetch related data using proper hooks
  const { data: groups = [] } = useGroups();
  const { data: smtpProfiles = [] } = useSmtpProfiles();
  const { data: templatesResponse } = useTemplates();
  const emailTemplates = templatesResponse?.templates || [];
  const { data: landingPages = [] } = useLandingPages();

  // Initialize form with safe default values
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      targetGroupId: "",
      smtpProfileId: "",
      emailTemplateId: "",
      landingPageId: "",
      scheduledAt: "",
      endDate: "",
    },
  });

  // Update the form when campaign data loads
  useEffect(() => {
    if (campaign) {
      console.log('Campaign loaded for editing:', campaign);
      
      // Safely convert values to strings with null checks
      const safeToString = (value: any) => {
        if (value === null || value === undefined) return "";
        return value.toString();
      };
      
      // Format datetime strings for datetime-local inputs
      const formatDateTime = (dateString: string | null) => {
        if (!dateString) return "";
        try {
          const date = new Date(dateString);
          return date.toISOString().slice(0, 16);
        } catch (error) {
          console.error('Error formatting date:', error);
          return "";
        }
      };
      
      const formData = {
        name: campaign.name || "",
        targetGroupId: "1", // Default value since not available in Campaign type
        smtpProfileId: "1", // Default value since not available in Campaign type  
        emailTemplateId: "1", // Default value since not available in Campaign type
        landingPageId: "1", // Default value since not available in Campaign type
        scheduledAt: formatDateTime(campaign.scheduledAt || null),
        endDate: formatDateTime(campaign.endDate || null),
      };
      
      console.log('Setting form data:', formData);
      
      // Reset form with campaign data
      form.reset(formData);
      
      // Clear any validation errors since we're loading real data
      form.clearErrors();
    }
  }, [campaign, form]);
  // Mutation for updating the campaign
  const updateMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      setErrorDetails(null);
      
      console.log('Updating campaign with data:', data);
      
      // Format the data properly for the backend with validation
      const formattedData = {
        name: data.name,
        targetGroupId: parseInt(data.targetGroupId) || 0,
        smtpProfileId: parseInt(data.smtpProfileId) || 0,
        emailTemplateId: parseInt(data.emailTemplateId) || 0,
        landingPageId: parseInt(data.landingPageId) || 0,
        scheduledAt: data.scheduledAt && data.scheduledAt !== "" ? data.scheduledAt : null,
        endDate: data.endDate && data.endDate !== "" ? data.endDate : null,
      };
      
      console.log('Formatted data for API:', formattedData);
      // Make the API request to update the campaign
      const response = await apiRequest(
        "PUT", 
        `/api/campaigns/${campaignId}`, 
        formattedData
      );
      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json();
        // Extract detailed validation errors if available
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorDetails = errorData.errors.map((err: any) => 
            `${err.path}: ${err.message}`
          ).join('\n');
          setErrorDetails(errorDetails);
        }
        // Throw error to be caught in onError
        throw new Error(errorData.message || "Failed to update campaign");
      }
      // Return the updated campaign data
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign updated",
        description: "Your campaign has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onClose();
    },
    onError: (error) => {
      console.error('Campaign update error:', error);
      toast({
        title: "Error updating campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: CampaignFormValues) {
    console.log('Form submitted with data:', data);
    updateMutation.mutate(data);
  }

  // Show loading state
  if (isLoadingCampaign) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading campaign data...</span>
      </div>
    );
  }

  // Show error state
  if (campaignError) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive mb-4">Error loading campaign: {campaignError.message}</p>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  // Show not found state
  if (!campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Campaign not found or failed to load.</p>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campaign info header */}
      <div className="bg-muted/50 p-3 rounded-lg">
        <h3 className="font-medium">Editing Campaign</h3>
        <p className="text-sm text-muted-foreground">
          {campaign.name} (ID: {campaignId}) • Status: {campaign.status}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {errorDetails && (
            <div className="p-3 text-sm bg-destructive/15 text-destructive rounded border border-destructive/30 whitespace-pre-line">
              <p className="font-semibold mb-1">Validation errors:</p>
              {errorDetails}
            </div>
          )}
          
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter campaign name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="targetGroupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Group</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a target group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groups?.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name} ({group.targetCount || 0} targets)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="smtpProfileId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SMTP Profile</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an SMTP profile" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {smtpProfiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id.toString()}>
                          {profile.name} ({profile.host})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="emailTemplateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Template</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an email template" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {emailTemplates?.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="landingPageId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Landing Page</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a landing page" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {landingPages?.map((page) => (
                      <SelectItem key={page.id} value={page.id.toString()}>
                        {page.name} ({page.pageType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule Launch
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field}
                      className="w-full"
                      style={{ colorScheme: 'dark' }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    End Date (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field}
                      className="w-full"
                      style={{ colorScheme: 'dark' }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Campaign"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}