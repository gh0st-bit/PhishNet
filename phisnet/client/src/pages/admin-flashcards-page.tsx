import AppLayout from "@/components/layout/app-layout";

export default function AdminFlashcardsPage() {
  return (
    <AppLayout title="Content: Flashcards">
      <div className="space-y-2">
        <p className="text-muted-foreground">Create and manage flashcard decks for microlearning.</p>
        <div className="rounded-md border p-8 flex flex-col items-center justify-center gap-2">
          <span className="text-muted-foreground">No flashcards yet. Add new to get started.</span>
          <button className="btn btn-primary" disabled>Add New Flashcard</button>
        </div>
      </div>
    </AppLayout>
  );
}
