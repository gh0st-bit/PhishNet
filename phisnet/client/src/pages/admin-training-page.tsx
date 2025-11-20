import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Edit, Trash2, Users, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TrainingModule {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  thumbnailUrl: string | null;
  videoUrl: string;
  isRequired: boolean;
  orderIndex: number;
  tags: string[];
  assignedCount: number;
  completedCount: number;
  createdAt: string;
}

interface ModuleFormData {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  videoUrl: string;
  thumbnailUrl: string;
  transcript: string;
  isRequired: boolean;
  orderIndex: number;
  tags: string;
}

export default function AdminTrainingPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [formData, setFormData] = useState<ModuleFormData>({
    title: "",
    description: "",
    category: "phishing",
    difficulty: "beginner",
    durationMinutes: 10,
    videoUrl: "",
    thumbnailUrl: "",
    transcript: "",
    isRequired: false,
    orderIndex: 0,
    tags: "",
  });

  // Fetch all training modules
  const { data, isLoading, error } = useQuery<{ modules: TrainingModule[] }>({
    queryKey: ["/api/admin/training-modules"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/training-modules");
      if (!res.ok) throw new Error("Failed to fetch modules");
      return res.json();
    },
  });

  // Create module mutation
  const createMutation = useMutation({
    mutationFn: async (data: ModuleFormData) => {
      const res = await apiRequest("POST", "/api/admin/training-modules", {
        ...data,
        tags: data.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      if (!res.ok) throw new Error("Failed to create module");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-modules"] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  // Update module mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ModuleFormData }) => {
      const res = await apiRequest("PUT", `/api/admin/training-modules/${id}`, {
        ...data,
        tags: data.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      if (!res.ok) throw new Error("Failed to update module");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-modules"] });
      setIsDialogOpen(false);
      setEditingModule(null);
      resetForm();
    },
  });

  // Delete module mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/training-modules/${id}`);
      if (!res.ok) throw new Error("Failed to delete module");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-modules"] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "phishing",
      difficulty: "beginner",
      durationMinutes: 10,
      videoUrl: "",
      thumbnailUrl: "",
      transcript: "",
      isRequired: false,
      orderIndex: 0,
      tags: "",
    });
  };

  const handleEdit = (module: TrainingModule) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      category: module.category,
      difficulty: module.difficulty,
      durationMinutes: module.durationMinutes,
      videoUrl: module.videoUrl,
      thumbnailUrl: module.thumbnailUrl || "",
      transcript: "",
      isRequired: module.isRequired,
      orderIndex: module.orderIndex,
      tags: module.tags.join(", "),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingModule) {
      updateMutation.mutate({ id: editingModule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This will also remove all user progress.`)) {
      deleteMutation.mutate(id);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "intermediate": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "advanced": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Training Modules</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage security training content for employees</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingModule(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingModule ? "Edit" : "Create"} Training Module</DialogTitle>
              <DialogDescription>
                {editingModule ? "Update the training module details" : "Add a new training module for employees"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Identifying Phishing Emails"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief overview of what this module covers..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phishing">Phishing</SelectItem>
                      <SelectItem value="passwords">Passwords</SelectItem>
                      <SelectItem value="social_engineering">Social Engineering</SelectItem>
                      <SelectItem value="data_protection">Data Protection</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="general">General Security</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty *</Label>
                  <Select value={formData.difficulty} onValueChange={(value) => setFormData({ ...formData, difficulty: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="videoUrl">Video URL *</Label>
                <Input
                  id="videoUrl"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  placeholder="https://..."
                  type="url"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                <Input
                  id="thumbnailUrl"
                  value={formData.thumbnailUrl}
                  onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="durationMinutes">Duration (minutes) *</Label>
                  <Input
                    id="durationMinutes"
                    type="number"
                    min="1"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: Number.parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orderIndex">Display Order</Label>
                  <Input
                    id="orderIndex"
                    type="number"
                    min="0"
                    value={formData.orderIndex}
                    onChange={(e) => setFormData({ ...formData, orderIndex: Number.parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="email, security, awareness"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={formData.isRequired}
                  onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isRequired" className="font-normal cursor-pointer">
                  Mark as required training
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingModule ? "Update" : "Create"} Module
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load training modules. Please try again.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data?.modules || []).map((module) => (
            <Card key={module.id} className="p-5 flex flex-col gap-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg line-clamp-2">{module.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{module.description}</p>
                </div>
                {module.isRequired && (
                  <Badge variant="secondary" className="shrink-0">Required</Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={getDifficultyColor(module.difficulty)}>
                  {module.difficulty}
                </Badge>
                <Badge variant="outline">{module.category}</Badge>
                <Badge variant="outline">{module.durationMinutes} min</Badge>
              </div>

              {module.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {module.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{module.assignedCount} assigned</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  <span>{module.completedCount} completed</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit(module)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(module.id, module.title)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}

          {!(data?.modules || []).length && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No training modules yet. Create your first one!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
