import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Globe, Save, Eye, EyeOff, Image as ImageIcon, ShieldOff } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

const landingPageSchema = z.object({
  name: z.string().min(1, "Landing page name is required"),
  description: z.string().optional(),
  htmlContent: z.string().min(1, "HTML content is required"),
  redirectUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  pageType: z.string().min(1, "Page type is required"),
  thumbnail: z.string().optional(),
  captureData: z.boolean().default(true),
  capturePasswords: z.boolean().default(false),
  enableMicrolearning: z.boolean().default(false),
  learningTitle: z.string().optional(),
  learningContent: z.string().optional(),
  learningTips: z.array(z.string()).default([]),
  remediationLinks: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
  })).default([]),
});

type LandingPageFormValues = z.infer<typeof landingPageSchema>;

interface LandingPageEditorProps {
  onClose: () => void;
  page?: any; // The page to edit if in edit mode
}

export default function LandingPageEditor({ onClose, page }: LandingPageEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [urlToClone, setUrlToClone] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const [thumbnailSource, setThumbnailSource] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const isEditing = !!page;

  const form = useForm<LandingPageFormValues>({
    resolver: zodResolver(landingPageSchema),
    defaultValues: {
      name: page?.name || "",
      description: page?.description || "",
      htmlContent: page?.htmlContent || "<div></div>",
      redirectUrl: page?.redirectUrl || "",
      pageType: page?.pageType || "login",
      thumbnail: page?.thumbnail || "",
      captureData: page?.captureData ?? true,
      capturePasswords: page?.capturePasswords ?? false,
      enableMicrolearning: page?.enableMicrolearning ?? false,
      learningTitle: page?.learningTitle || "",
      learningContent: page?.learningContent || "",
      learningTips: page?.learningTips || [],
      remediationLinks: page?.remediationLinks || [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: LandingPageFormValues) => {
      // If we have a thumbnailSource, include it in the data
      if (thumbnailSource) {
        data.thumbnail = thumbnailSource;
      }

      const url = isEditing 
        ? `/api/landing-pages/${page.id}` 
        : "/api/landing-pages";
      const method = isEditing ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: `Landing page ${isEditing ? 'updated' : 'created'}`,
        description: `Your landing page has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/landing-pages'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: `Error ${isEditing ? 'updating' : 'creating'} landing page`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest('POST', '/api/landing-pages/clone', { url });
      return await response.json();
    },
    onSuccess: (data) => {
      // Support both { htmlContent } and legacy { html }
      const html = data.htmlContent || data.html || "";
      form.setValue("htmlContent", html);
      form.setValue("name", data.title || "Cloned Website");
      // Try to extract a thumbnail from the HTML
      try {
        const og = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        const img = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        let thumb = og?.[1] || img?.[1] || null;
        if (thumb && thumb.startsWith('/') && urlToClone) {
          try {
            const base = new URL(urlToClone).origin;
            thumb = base + thumb;
          } catch {}
        }
        if (thumb) setThumbnailSource(thumb);
      } catch {}
      setIsCloning(false);
      setUrlToClone("");
      toast({
        title: "Website cloned successfully",
        description: "The website content has been imported into the editor.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to clone website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCloneWebsite = () => {
    if (!urlToClone.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid URL to clone.",
        variant: "destructive",
      });
      return;
    }
    
    // Basic URL validation
    try {
      new URL(urlToClone);
      cloneMutation.mutate(urlToClone);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL (e.g., https://example.com).",
        variant: "destructive",
      });
    }
  };

  // Thumbnail extraction happens during clone onSuccess

  // Update the preview whenever HTML content changes
  useEffect(() => {
    if (activeTab === "preview" && previewFrameRef.current) {
      const doc = previewFrameRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(form.getValues("htmlContent"));
        doc.close();
      }
    }
  }, [activeTab, form.watch("htmlContent")]);

  // Load the preview when the component mounts if we're editing an existing page
  useEffect(() => {
    if (isEditing && page.thumbnail) {
      setThumbnailSource(page.thumbnail);
    }
  }, [isEditing, page]);

  function onSubmit(data: LandingPageFormValues) {
    if (thumbnailSource) {
      data.thumbnail = thumbnailSource;
    }
    mutation.mutate(data);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-lg font-medium border-b pb-4">
        {isEditing ? "Edit Landing Page" : "Create Landing Page"}
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2">
        {isCloning ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <h3 className="font-medium">Clone Website</h3>
            </div>
            <div className="space-y-3">
              <div>
        <label className="text-sm font-medium" htmlFor="clone-url">Website URL</label>
                <div className="mt-1">
                  <Input
          id="clone-url"
                    placeholder="https://example.com"
                    value={urlToClone}
                    onChange={(e) => setUrlToClone(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the URL of the website you want to clone
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleCloneWebsite}
                  disabled={cloneMutation.isPending}
                  size="sm"
                >
                  {cloneMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      Clone Website
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCloning(false)}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landing Page Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter page name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="pageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Page Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select page type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="login">Login Page</SelectItem>
                          <SelectItem value="form">Form Page</SelectItem>
                          <SelectItem value="educational">Educational</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="captureData"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Capture Submitted Data</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-muted-foreground">Store non-sensitive form fields when users submit the page</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capturePasswords"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Capture Passwords (Advanced)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.value}
                          disabled={!form.getValues("captureData")}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-muted-foreground">Include fields that look like passwords (use with caution)</span>
                      </div>
                    </FormControl>
                    {field.value && (
                      <div className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                        <ShieldOff className="h-3 w-3" />
                        Capturing passwords stores raw secrets. Ensure legal consent and secure handling.
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter page description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="redirectUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Redirect URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Thumbnail preview */}
              <div className="mb-4">
                <FormLabel>Page Thumbnail</FormLabel>
                <div className="mt-2 border rounded-md overflow-hidden bg-muted/30">
                  <div className="aspect-video relative">
                    {thumbnailSource ? (
                      <img 
                        src={thumbnailSource} 
                        alt="Page Thumbnail" 
                        className="w-full h-full object-cover"
                        onError={() => setThumbnailSource(null)} // Handle image load errors
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 text-xs text-muted-foreground">
                    Thumbnail will be automatically generated from page content
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <FormLabel>HTML Content</FormLabel>
                  <Tabs defaultValue="editor" value={activeTab} onValueChange={setActiveTab} className="w-auto">
                    <TabsList className="grid grid-cols-2 w-[200px]">
                      <TabsTrigger value="editor" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Code
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                {activeTab === "editor" ? (
                  <FormField
                    control={form.control}
                    name="htmlContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter HTML content" 
                            {...field} 
                            className="font-mono text-sm h-64"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <Card className="overflow-hidden p-0 h-[400px]">
                    <iframe 
                      ref={previewFrameRef}
                      title="Landing Page Preview"
                      sandbox="allow-same-origin"
                      className="w-full h-full border-0"
                      srcDoc={form.getValues("htmlContent")}
                    />
                  </Card>
                )}
              </div>
            </form>
          </Form>
        )}
      </div>
      
      {/* Fixed button bar at the bottom */}
      <div className="border-t pt-4 mt-4 flex justify-between sticky bottom-0 bg-background">
        {isCloning ? (
          <div className="flex justify-end space-x-2 w-full">
            <Button variant="outline" onClick={() => setIsCloning(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsCloning(true)}
            >
              <Globe className="mr-2 h-4 w-4" />
              Clone Website
            </Button>
            
            <div className="space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                onClick={form.handleSubmit(onSubmit)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditing ? "Update" : "Create"}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}