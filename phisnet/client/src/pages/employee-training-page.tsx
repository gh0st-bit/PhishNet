import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Play, ListChecks } from "lucide-react";

interface TrainingModule {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  progressPercentage: number | null;
  progressStatus: string | null;
  completedAt: string | null;
  dueDate: string | null;
}

interface TrainingResponse {
  modules: TrainingModule[];
}

export default function EmployeeTrainingPage() {
  const { data, isLoading, refetch } = useQuery<TrainingResponse>({
    queryKey: ["/api/employee/training"],
    queryFn: async () => {
      const res = await fetch("/api/employee/training");
      if (!res.ok) throw new Error("Failed to fetch training modules");
      return res.json();
    },
    staleTime: 30000,
  });

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Training Modules</h1>
          <p className="text-sm text-muted-foreground">Your assigned learning content</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.modules || []).map((m) => {
          const status = m.progressStatus || "not_started";
          const cta = status === "completed" ? "Review" : status === "in_progress" ? "Continue" : "Start";
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="h-4 w-4" />
                    <h3 className="font-medium">{m.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.category} • {m.difficulty}</p>
                </div>
                <div className="text-xs text-muted-foreground">{m.progressPercentage ?? 0}%</div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started'}
                </div>
                <Button size="sm" className="gap-2">
                  {status === 'completed' ? <ListChecks className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {cta}
                </Button>
              </div>
            </Card>
          );
        })}
        {!isLoading && (data?.modules || []).length === 0 && (
          <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">
            No training modules assigned yet.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
