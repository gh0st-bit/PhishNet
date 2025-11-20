import AppLayout from "@/components/layout/app-layout";

export default function AdminArticlesPage() {
  return (
    <AppLayout title="Content: Articles">
      <div className="space-y-2">
        <p className="text-muted-foreground">Manage knowledge-base style articles for employees.</p>
        <div className="rounded-md border p-8 flex flex-col items-center justify-center gap-2">
          <span className="text-muted-foreground">No articles yet. Add new to get started.</span>
          <button className="btn btn-primary" disabled>Add New Article</button>
        </div>
      </div>
    </AppLayout>
  );
}
