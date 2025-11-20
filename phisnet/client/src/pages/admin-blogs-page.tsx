import AppLayout from "@/components/layout/app-layout";

export default function AdminBlogsPage() {
  return (
    <AppLayout title="Content: Blogs">
      <div className="space-y-2">
        <p className="text-muted-foreground">Publish blog-style updates and learning posts.</p>
        <div className="rounded-md border p-8 flex flex-col items-center justify-center gap-2">
          <span className="text-muted-foreground">No blogs yet. Add new to get started.</span>
          <button className="btn btn-primary" disabled>Add New Blog</button>
        </div>
      </div>
    </AppLayout>
  );
}
