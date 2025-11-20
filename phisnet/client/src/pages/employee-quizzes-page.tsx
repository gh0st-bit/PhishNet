import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, HelpCircle, Play } from "lucide-react";

interface Quiz {
  id: number;
  title: string;
  bestScore?: number;
  passingScore?: number;
}

interface QuizzesResponse {
  quizzes: Quiz[];
}

export default function EmployeeQuizzesPage() {
  const { data, isLoading, refetch } = useQuery<QuizzesResponse>({
    queryKey: ["/api/employee/quizzes"],
    queryFn: async () => {
      const res = await fetch("/api/employee/quizzes");
      if (!res.ok) throw new Error("Failed to fetch quizzes");
      return res.json();
    },
    staleTime: 30000,
  });

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quizzes</h1>
          <p className="text-sm text-muted-foreground">Test your knowledge</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.quizzes || []).map((q) => (
          <Card key={q.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <HelpCircle className="h-4 w-4" />
                  <h3 className="font-medium">{q.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">Passing Score: {q.passingScore ?? 70}%</p>
              </div>
              {typeof q.bestScore === 'number' && (
                <div className="text-xs text-muted-foreground">Best: {q.bestScore}%</div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" className="gap-2">
                <Play className="h-4 w-4" /> Take Quiz
              </Button>
            </div>
          </Card>
        ))}
        {!isLoading && (data?.quizzes || []).length === 0 && (
          <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">
            No quizzes assigned yet.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
