import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Award } from "lucide-react";

interface Badge {
  id: number;
  name: string;
  description?: string;
  rarity?: string;
}

interface BadgesResponse {
  badges: Badge[];
}

export default function EmployeeBadgesPage() {
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
          <Card key={b.id} className="p-5 flex items-center gap-3">
            <Award className="h-6 w-6" />
            <div>
              <div className="font-medium">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.description || '—'}</div>
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
