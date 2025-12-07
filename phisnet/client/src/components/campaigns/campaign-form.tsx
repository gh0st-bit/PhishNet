import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { 
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
// Define the props for CampaignForm component
interface CampaignFormProps {
  onClose: () => void;
}
// CampaignForm component for creating a new campaign
export default function CampaignForm({ onClose }: CampaignFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  // Fetch necessary data for form selects
  const { data: groups = [] } = useGroups();
  const { data: smtpProfiles = [] } = useSmtpProfiles();
  const { data: templatesResponse } = useTemplates();
  // Extract templates array from response, fallback to empty array
  const emailTemplates = Array.isArray(templatesResponse) 
    ? templatesResponse 
    : (templatesResponse?.templates || []);
  const { data: landingPages = [] } = useLandingPages();
  // Initialize the form with react-hook-form and zod validation
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
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
  // Mutation for creating a new campaign
  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      setErrorDetails(null);
      console.log("Sending campaign data:", data);
      
      // Format the data properly for the backend
      const formattedData = {
        name: data.name,
        targetGroupId: parseInt(data.targetGroupId),
        smtpProfileId: parseInt(data.smtpProfileId),
        emailTemplateId: parseInt(data.emailTemplateId),
        landingPageId: parseInt(data.landingPageId),
        scheduledAt: data.scheduledAt && data.scheduledAt !== "" ? data.scheduledAt : null,
        endDate: data.endDate && data.endDate !== "" ? data.endDate : null,
      };
      // Debug log the formatted data
      console.log("Formatted campaign data:", formattedData);
      // Make the API request to create the campaign
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formattedData),
      });
      // Handle non-OK responses
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Campaign creation error:", errorData);
        //  Extract detailed validation errors if available
        if (errorData.errors && Array.isArray(errorData.errors)) {
          // Show detailed validation errors
          const errorDetails = errorData.errors.map((err: any) => 
            `${err.path}: ${err.message}`
          ).join('\n');
          setErrorDetails(errorDetails);
        }
        // Throw error to be caught in onError
        throw new Error(errorData.message || "Failed to create campaign");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign created",
        description: "Your campaign has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error creating campaign",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  // Handle form submission
  function onSubmit(data: CampaignFormValues) {
    console.log("Form values:", data);
    createMutation.mutate(data);
  }
  // Render the campaign creation form
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        {group.name}
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
                        {profile.name}
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
              <Select 
                onValueChange={(value) => {
                  console.log("Selected template ID:", value);
                  field.onChange(value);
                }} 
                value={field.value}
              >
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
                      {page.name}
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
                <FormLabel>Schedule Launch</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
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
                <FormLabel>End Date (Optional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Campaign"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
