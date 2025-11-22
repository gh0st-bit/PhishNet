import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface Badge {
  id: number;
  name: string;
  description?: string;
  rarity?: string;
  earned?: boolean;
  earnedAt?: string | null;
}

interface BadgesResponse {
  badges: Badge[];
}

export default function EmployeeBadgesPage() {
  const [, setLocation] = useLocation();
  
  const { data, isLoading } = useQuery<BadgesResponse>({
    queryKey: ["/api/employee/badges"],
    queryFn: async () => {
      const res = await fetch("/api/employee/badges");
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    },
    staleTime: 30000,
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Badges</h1>
        <p className="text-sm text-muted-foreground">Achievements you've earned</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.badges || []).map((b) => (
          <Card key={b.id} className="p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation(`/employee/badges/${b.id}`)}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${b.earned ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-muted'}`}>
                <Award className={`h-5 w-5 ${b.earned ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {b.name}
                  {b.earned && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Earned</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">{b.description || 'No description'}</div>
                {b.earnedAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(b.earnedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        ))}
        {!isLoading && (data?.badges || []).length === 0 && (
          <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">
            You haven't earned any badges yet.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
