import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLandingPages } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import LandingPageEditor from "@/components/landing-pages/landing-page-editor";
import { 
  Ghost, 
  Plus, 
  Edit, 
  Copy, 
  Trash2, 
  ExternalLink,
  Eye,
  Image as ImageIcon
} from "lucide-react";

export default function LandingPagesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: landingPages = [] } = useLandingPages();

  const handleCreate = () => {
    setSelectedPage(null);
    setIsCreating(true);
  };

  const handleEdit = (page: any) => {
    setSelectedPage(page);
    setIsCreating(true);
  };

  const handlePreview = (page: any) => {
    setSelectedPage(page);
    setIsPreviewOpen(true);
    
    // Open in a new browser window with target="_blank"
    window.open(`/api/landing-pages/${page.id}/preview`, '_blank');
  };

  // Delete landing page
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/landing-pages/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete landing page');
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-pages'] });
      toast({ title: 'Landing page deleted' });
    },
    onError: (e: any) => {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  });

  // Clone landing page
  const cloneMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/landing-pages/${id}/clone`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to clone landing page');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-pages'] });
      toast({ title: 'Landing page cloned' });
    },
    onError: (e: any) => {
      toast({ title: 'Clone failed', description: e.message, variant: 'destructive' });
    }
  });

  // Filter pages by type for tab content
  const filterPagesByType = (type: string) => {
    const items = landingPages?.filter(page => type === 'all' || page.pageType === type) || [];
    // Safety: ensure sorted by category (pageType) then name client-side as well
    return [...items].sort((a: any, b: any) => {
      const cat = (a.pageType || '').localeCompare(b.pageType || '');
      if (cat !== 0) return cat;
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Landing Pages</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Landing Page
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6 bg-muted p-1 h-auto">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            All Pages
          </TabsTrigger>
          <TabsTrigger 
            value="login" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Login Pages
          </TabsTrigger>
          <TabsTrigger 
            value="form" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Form Pages
          </TabsTrigger>
          <TabsTrigger 
            value="educational" 
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Educational
          </TabsTrigger>
        </TabsList>

        {['all', 'login', 'form', 'educational'].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue} className="space-y-6">
            {filterPagesByType(tabValue).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterPagesByType(tabValue).map((page) => (
                  <Card key={page.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-secondary">
                      {page.thumbnail ? (
                        <img 
                          src={page.thumbnail} 
                          alt={page.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If image fails to load, show the ghost icon
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
                            const ghost = document.createElement('div');
                            ghost.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-muted-foreground opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
                            (e.target as HTMLImageElement).parentElement?.appendChild(ghost);
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium mb-1">{page.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {page.description || "No description provided"}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(page.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handlePreview(page)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(page)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => cloneMutation.mutate(page.id)} title="Clone">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Delete landing page "${page.name}"?`)) {
                                deleteMutation.mutate(page.id);
                              }
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Ghost className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No landing pages found</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Create your first landing page to capture credentials or deliver security awareness training.
                  </p>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Create Landing Page
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Landing Page Editor Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-4xl p-0" style={{ maxHeight: '90vh', height: 'auto' }}>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 2rem)' }}>
            <div className="p-6">
              <LandingPageEditor 
                page={selectedPage} 
                onClose={() => setIsCreating(false)} 
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
