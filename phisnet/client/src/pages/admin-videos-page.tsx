import AppLayout from "@/components/layout/app-layout";

export default function AdminVideosPage() {
  return (
    <AppLayout title="Content: Videos">
      <div className="space-y-2">
        <p className="text-muted-foreground">Manage training videos and playlists.</p>
        <div className="rounded-md border p-8 flex flex-col items-center justify-center gap-2">
          <span className="text-muted-foreground">No videos yet. Add new to get started.</span>
          <button className="btn btn-primary" disabled>Add New Video</button>
        </div>
      </div>
    </AppLayout>
  );
}
