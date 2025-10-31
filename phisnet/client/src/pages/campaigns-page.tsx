import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CampaignForm from "@/components/campaigns/campaign-form";
import CampaignEditor from "@/components/campaigns/campaign-editor";
import CampaignDetails from "@/components/campaigns/campaign-details";
import { Plus, ChevronRight, Calendar, Mail, Users, Edit, Trash2, Loader2, FileText, FileSpreadsheet, FileJson, FileDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCampaigns } from "@/hooks/useApi";
import { getBadgeVariant, safeToString } from "@/lib/utils";
import type { Campaign } from "@shared/types/api";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CampaignsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  
  const { data: campaigns = [], isLoading, error } = useCampaigns();

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      console.log('Deleting campaign with ID:', campaignId);
      
      const response = await apiRequest('DELETE', `/api/campaigns/${campaignId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete response error:', errorText);
        
        // Try to parse as JSON, but handle HTML error pages
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || 'Failed to delete campaign');
        } catch (parseError) {
          // If it's not JSON (like an HTML error page), throw a generic error
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign deleted",
        description: "The campaign has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: (error) => {
      console.error('Campaign deletion error:', error);
      toast({
        title: "Error deleting campaign",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const exportMutation = useMutation({
    mutationFn: async ({ campaignId, format }: { campaignId: number; format: string }) => {
      const response = await apiRequest('POST', `/api/campaigns/${campaignId}/export`, {
        format: format,
        theme: theme // Pass current theme to server
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export campaign report');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      const formatName = data.format === 'xlsx' ? 'Excel' : 
                         data.format === 'json' ? 'JSON' : 
                         data.format === 'csv' ? 'CSV' : 'PDF';
      
      // Create a download link and trigger it
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Report exported",
        description: `Campaign report has been exported as ${formatName}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleExport = (campaignId: number, format: string) => {
    exportMutation.mutate({ campaignId, format });
  };

  const handleEdit = (campaignId: number) => {
    console.log('Edit button clicked for campaign ID:', campaignId);
    setSelectedCampaignId(campaignId);
    setIsEditing(true);
  };

  const handleView = (campaignId: number) => {
    setSelectedCampaignId(campaignId);
    setIsViewing(true);
  };

  const handleDeleteClick = (campaignId: number) => {
    setCampaignToDelete(campaignId);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (campaignToDelete !== null) {
      deleteMutation.mutate(campaignToDelete);
    }
  };

  // This function allows editing from the view screen
  const handleEditFromView = () => {
    setIsViewing(false);
    setIsEditing(true);
  };

  // Check URL for the action parameter when component mounts
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const action = searchParams.get('action');
    
    if (action === 'create') {
      setIsCreating(true);
      // Clean up URL (optional)
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Campaign
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Targets</TableHead>
                <TableHead>Open Rate</TableHead>
                <TableHead>Click Rate</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading campaigns...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-destructive">
                    Error loading campaigns: {error.message}
                  </TableCell>
                </TableRow>
              ) : campaigns && campaigns.length > 0 ? (
                campaigns.map((campaign: Campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{safeToString(campaign.name)}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(safeToString(campaign.status))}>
                        {safeToString(campaign.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.targets || 0}</TableCell>
                    <TableCell>{campaign.targets ? `${Math.round((campaign.opened / campaign.targets) * 100)}%` : "-"}</TableCell>
                    <TableCell>{campaign.targets ? `${Math.round((campaign.clicked / campaign.targets) * 100)}%` : "-"}</TableCell>
                    <TableCell>
                      {campaign.created_at ? formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true }) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={exportMutation.isPending}
                            >
                              {exportMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Export Report</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport(campaign.id, 'pdf')}>
                              <FileText className="mr-2 h-4 w-4" />
                              PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport(campaign.id, 'xlsx')}>
                              <FileSpreadsheet className="mr-2 h-4 w-4" />
                              Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport(campaign.id, 'json')}>
                              <FileJson className="mr-2 h-4 w-4" />
                              JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport(campaign.id, 'csv')}>
                              <FileDown className="mr-2 h-4 w-4" />
                              CSV
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(campaign.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleView(campaign.id)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteClick(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No campaigns found. Create your first campaign to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
            <CampaignForm onClose={() => setIsCreating(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
            {selectedCampaignId && (
              <CampaignEditor 
                campaignId={selectedCampaignId} 
                onClose={() => setIsEditing(false)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Campaign Dialog */}
      <Dialog open={isViewing} onOpenChange={setIsViewing}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Campaign Details</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
            {selectedCampaignId && (
              <CampaignDetails 
                campaignId={selectedCampaignId} 
                onEdit={handleEditFromView}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the campaign
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"  
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
