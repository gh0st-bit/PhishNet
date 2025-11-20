import AppLayout from "@/components/layout/app-layout";

export default function AdminMcqsPage() {
  return (
    <AppLayout title="Content: MCQs">
      <div className="space-y-2">
        <p className="text-muted-foreground">Build and manage question banks for quizzes.</p>
        <div className="rounded-md border p-8 flex flex-col items-center justify-center gap-2">
          <span className="text-muted-foreground">No MCQs yet. Add new to get started.</span>
          <button className="btn btn-primary" disabled>Add New MCQ</button>
        </div>
      </div>
    </AppLayout>
  );
}
