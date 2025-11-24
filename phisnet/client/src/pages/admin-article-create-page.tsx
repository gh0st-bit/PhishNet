import AppLayout from "@/components/layout/app-layout";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import SunEditor from "suneditor-react";
import "suneditor/dist/css/suneditor.min.css";
import { Loader2 } from "lucide-react";

interface CreateArticlePayload {
  title: string;
  category: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  thumbnailUrl?: string;
  readTimeMinutes?: number | null;
  published: boolean;
}

export default function AdminArticleCreatePage() {
  const [form, setForm] = useState({
    title: "",
    category: "",
    excerpt: "",
    tags: "",
    thumbnailUrl: "",
    readTimeMinutes: "",
    content: "<p>Start writing your article...</p>",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent, published: boolean = true) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload: CreateArticlePayload = {
        title: form.title.trim(),
        category: form.category.trim(),
        content: form.content, // HTML from editor
        excerpt: form.excerpt.trim() || undefined,
        tags: form.tags
          ? form.tags.split(",").map(t => t.trim()).filter(Boolean)
          : undefined,
        thumbnailUrl: form.thumbnailUrl.trim() || undefined,
        readTimeMinutes: form.readTimeMinutes ? parseInt(form.readTimeMinutes, 10) : undefined,
        published,
      };

      const res = await fetch("/api/admin/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create article");
      }
      
      // Invalidate notification queries to show new notification immediately
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      
      toast({
        title: published ? "✓ Article Published" : "✓ Draft Saved",
        description: published 
          ? "Article created and published successfully."
          : "Article saved as draft. You can publish it later from the articles page.",
      });
      
      // Always redirect back to articles list after successful save
      setTimeout(() => navigate("/admin/content/articles"), 1200);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error",
        description: err.message || "Failed to save article",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Create Article</h1>
          <p className="text-sm text-muted-foreground">Compose rich training or awareness content.</p>
        </div>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category *</label>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required placeholder="e.g. training" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
              <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="security, phishing" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Thumbnail URL</label>
              <Input value={form.thumbnailUrl} onChange={e => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Estimated Read Time (minutes)</label>
              <Input type="number" min={1} value={form.readTimeMinutes} onChange={e => setForm({ ...form, readTimeMinutes: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Excerpt</label>
              <Textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={3} placeholder="Short summary" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Content *</label>
            <SunEditor
              onChange={(content) => setForm(prev => ({ ...prev, content }))}
              setContents={form.content}
              setOptions={{
                height: 400,
                resizeEnable: false,
                showPathLabel: false,
                font: ["Arial", "Verdana", "Times New Roman", "Courier"],
                buttonList: [
                  ['undo', 'redo'],
                  ['formatBlock', 'font', 'fontSize'],
                  ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                  ['fontColor', 'hiliteColor', 'removeFormat'],
                  ['align', 'list', 'table'],
                  ['link', 'image', 'video'],
                  ['horizontalRule', 'codeView'],
                  ['preview', 'print']
                ],
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/content/articles")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => handleSubmit(e, false)}
              disabled={saving || !form.title.trim() || !form.category.trim()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.title.trim() || !form.category.trim()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publish Article
            </Button>
          </div>
        </form>
      </Card>
      <div className="mt-6 text-xs text-muted-foreground">
        <p>HTML content is stored directly. Consider adding server-side sanitization to prevent unsafe tags if user-generated content is exposed broadly.</p>
      </div>
    </AppLayout>
  );
}
