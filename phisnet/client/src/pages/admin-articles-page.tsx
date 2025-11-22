import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, Search, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { articleFormSchema } from "@/validation/adminSchemas";
import { useAuth } from "@/hooks/use-auth";

interface Article {
  id: number;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string[];
  thumbnailUrl: string | null;
  author: number | null;
  authorName?: string | null;
  readTimeMinutes: number | null;
  publishedAt: string;
  updatedAt: string;
}

interface ArticleFormData {
  title: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string; // comma-separated in form
  thumbnailUrl: string;
  readTimeMinutes: number;
}

interface PaginatedArticlesResponse {
  articles: Article[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminArticlesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [formData, setFormData] = useState<ArticleFormData>({
    title: "",
    content: "",
    excerpt: "",
    category: "general",
    tags: "",
    thumbnailUrl: "",
    readTimeMinutes: 5,
  });
  const [articleFormErrors, setArticleFormErrors] = useState<string[]>([]);

  // Fetch articles with pagination
  const { data, isLoading, error } = useQuery<PaginatedArticlesResponse>({
    queryKey: ["/api/admin/articles", { search: searchTerm, category: categoryFilter, page, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      });
      const res = await apiRequest("GET", `/api/admin/articles?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (fd: ArticleFormData) => {
      const res = await apiRequest("POST", "/api/admin/articles", {
        ...fd,
        tags: fd.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      if (!res.ok) throw new Error("Failed to create article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
      setIsDialogOpen(false);
      resetForm();
      setPage(1);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ArticleFormData }) => {
      const res = await apiRequest("PUT", `/api/admin/articles/${id}`, {
        ...data,
        tags: data.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      if (!res.ok) throw new Error("Failed to update article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
      setIsDialogOpen(false);
      setEditingArticle(null);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/articles/${id}`);
      if (!res.ok) throw new Error("Failed to delete article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      excerpt: "",
      category: "general",
      tags: "",
      thumbnailUrl: "",
      readTimeMinutes: 5,
    });
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt || "",
      category: article.category,
      tags: article.tags.join(", "),
      thumbnailUrl: article.thumbnailUrl || "",
      readTimeMinutes: article.readTimeMinutes || 5,
    });
    setArticleFormErrors([]);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setArticleFormErrors([]);
    const parsed = articleFormSchema.safeParse({
      title: formData.title,
      content: formData.content,
      excerpt: formData.excerpt || undefined,
      category: formData.category,
      tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
      readTimeMinutes: formData.readTimeMinutes || 0,
    });
    if (!parsed.success) {
      setArticleFormErrors(parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      return;
    }
    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Delete article "${title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const articles = data?.articles || [];
  const isAdmin = !!user?.isAdmin;

  return (
    <AppLayout title="Content: Articles">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-7 w-7" />
            <div>
              <h1 className="text-2xl font-bold">Articles</h1>
              <p className="text-muted-foreground text-sm">Manage internal knowledge & awareness content.</p>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={o => { if (!o) { setIsDialogOpen(false); setEditingArticle(null); setArticleFormErrors([]); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingArticle(null); setIsDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> New Article
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingArticle ? "Edit Article" : "Create Article"}</DialogTitle>
                  <DialogDescription>Provide structured awareness content for employees.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {articleFormErrors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription className="space-y-1">
                        {articleFormErrors.map(err => <div key={err}>{err}</div>)}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input id="category" placeholder="e.g. phishing" value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma separated)</Label>
                      <Input id="tags" value={formData.tags} onChange={e => setFormData(f => ({ ...f, tags: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="readTime">Read Time (minutes)</Label>
                      <Input id="readTime" type="number" min={1} value={formData.readTimeMinutes} onChange={e => setFormData(f => ({ ...f, readTimeMinutes: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="thumbnail">Thumbnail URL</Label>
                      <Input id="thumbnail" value={formData.thumbnailUrl} onChange={e => setFormData(f => ({ ...f, thumbnailUrl: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="excerpt">Excerpt</Label>
                      <Textarea id="excerpt" rows={2} value={formData.excerpt} onChange={e => setFormData(f => ({ ...f, excerpt: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="content">Content (Markdown)</Label>
                      <Textarea id="content" rows={10} value={formData.content} onChange={e => setFormData(f => ({ ...f, content: e.target.value }))} required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingArticle(null); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editingArticle ? "Save Changes" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label htmlFor="search" className="text-xs uppercase">Search</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input id="search" placeholder="Title or content..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div className="min-w-[160px] space-y-1">
              <Label htmlFor="categoryFilter" className="text-xs uppercase">Category</Label>
              <Input id="categoryFilter" placeholder="Filter category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] }); }}>
              Refresh
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading articles...</div>
          )}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">Failed to load articles.</div>
          )}

          {!isLoading && articles.length === 0 && (
            <div className="border rounded-md p-8 flex flex-col items-center justify-center gap-2">
              <span className="text-muted-foreground">No articles found.</span>
              {isAdmin && <Button onClick={() => { resetForm(); setEditingArticle(null); setIsDialogOpen(true); }} size="sm"><Plus className="h-4 w-4 mr-2" /> New Article</Button>}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map(article => (
              <div key={article.id} className="border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold line-clamp-2">{article.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs">{article.category}</Badge>
                      {article.tags.slice(0,3).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(article)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(article.id, article.title)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
                {article.thumbnailUrl && (
                  <img src={article.thumbnailUrl} alt="thumb" className="h-32 w-full object-cover rounded-md" />
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">{article.excerpt || article.content.slice(0,160)}{article.content.length > 160 && "..."}</p>
                <div className="text-xs flex justify-between text-muted-foreground">
                  <span>{article.readTimeMinutes ? `${article.readTimeMinutes} min read` : ""}</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          {data && data.total > data.pageSize && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, data.total)} of {data.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs font-medium">Page {page} / {data.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
