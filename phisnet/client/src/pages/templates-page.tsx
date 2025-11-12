import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import TemplateEditor from "@/components/templates/template-editor";
import TemplatePreview from "@/components/templates/template-preview";
import { Plus, Pencil, Eye, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmailTemplate } from "@shared/schema";
import { useLocation } from "wouter";

// Define a full interface for the template to match our database schema
interface Template {
  id: number;
  name: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  sender_name: string;
  sender_email: string;
  organization_id: number;
  created_at: string | Date;
  updated_at: string | Date;
  created_by_id: number | null;
  // These fields might come from our app's logic, not directly from DB
  type?: string | null;
  complexity?: string | null;
  description?: string | null;
  category?: string | null;
}

export default function TemplatesPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['/api/email-templates'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest('DELETE', `/api/email-templates/${templateId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template deleted",
        description: "The email template has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setIsEditing(true);
  };

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template);
    setIsPreviewing(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsEditing(true);
  };
  
  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.id);
    }
  };

  const handleCreateCampaign = () => {
    // Navigate to campaigns page with a query parameter to open the editor
    navigate("/campaigns?action=create");
  };

  return (
    <AppLayout>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle>Phishing Templates</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Your current Phishing emails are listed below. Use the action icons to view or edit a template.
          </p>
        </CardHeader>
      </Card>

      <div className="flex space-x-4 mb-6">
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create New Template
        </Button>
        <Button variant="outline" onClick={handleCreateCampaign}>
          <Plus className="mr-2 h-4 w-4" /> Create New Campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Complexity</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates && templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>Phishing - {template.category || "Home & Personal"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-secondary/30">
                        {template.complexity || "Medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handlePreview(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteClick(template)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No templates found. Create your first email template.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-5xl h-[85vh]">
          <TemplateEditor 
            template={selectedTemplate ? { ...selectedTemplate, type: selectedTemplate.type ?? null } : null} 
            onClose={() => setIsEditing(false)} 
          />
        </DialogContent>
      </Dialog>
      
      {/* Template Preview Dialog */}
      <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
        <DialogContent className="max-w-5xl h-[85vh] dialog-content-preview">
          {selectedTemplate && (
            <TemplatePreview template={{
              ...selectedTemplate,
              created_at: selectedTemplate.created_at instanceof Date ? selectedTemplate.created_at : new Date(selectedTemplate.created_at),
              updated_at: selectedTemplate.updated_at instanceof Date ? selectedTemplate.updated_at : new Date(selectedTemplate.updated_at),
              type: selectedTemplate.type ?? null,
              description: selectedTemplate.description ?? '',
              created_by_id: selectedTemplate.created_by_id ?? null,
              complexity: selectedTemplate.complexity ?? null,
              category: selectedTemplate.category ?? null
            }} />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? 
              This action cannot be undone.
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
