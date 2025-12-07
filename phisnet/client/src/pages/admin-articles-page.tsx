import { useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Trash2, Search, FileText, PenLine, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

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
  published: boolean;
  publishedAt: string;
  updatedAt: string;
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
  const isAdmin = !!user?.isAdmin;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

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

  // Publish toggle mutation
  const publishMutation = useMutation({
    mutationFn: async ({ id, published }: { id: number; published: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/articles/${id}/publish`, { published });
      if (!res.ok) throw new Error("Failed to update publish status");
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/articles"] });
      toast({
        title: variables.published ? "✓ Article Published" : "✓ Article Unpublished",
        description: variables.published 
          ? "Article is now visible to employees." 
          : "Article is now hidden from employees.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update article status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Delete article "${title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const articles = data?.articles || [];

  return (
    <AppLayout>
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
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate("/admin/content/articles/new")} size="lg" className="gap-2">
                <PenLine className="h-4 w-4" /> Create Article
              </Button>
            </div>
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
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map(article => (
              <div key={article.id} className="border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold line-clamp-2 mb-2">{article.title}</h3>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={article.published ? "default" : "secondary"} className="text-xs">
                        {article.published ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{article.category}</Badge>
                      {article.tags.slice(0,2).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  </div>
                </div>
                {article.thumbnailUrl && (
                  <img src={article.thumbnailUrl} alt="thumb" className="h-32 w-full object-cover rounded-md" />
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">{article.excerpt || article.content.slice(0,160)}{article.content.length > 160 && "..."}</p>
                <div className="text-xs flex justify-between text-muted-foreground">
                  <span>{article.readTimeMinutes ? `${article.readTimeMinutes} min read` : ""}</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-2 border-t">
                    {article.published ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-1 flex-1"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate({ id: article.id, published: false })}
                      >
                        {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                        Unpublish
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="default"
                        className="gap-1 flex-1"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate({ id: article.id, published: true })}
                      >
                        {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        Publish
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/content/articles/edit/${article.id}`)}><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(article.id, article.title)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
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
