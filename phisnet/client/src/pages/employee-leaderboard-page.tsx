import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";

interface LeaderboardEntry {
  userId: number;
  fullName: string;
  total_points: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export default function EmployeeLeaderboardPage() {
  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/employee/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/employee/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    staleTime: 30000,
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Top performers in your organization</p>
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          {(data?.leaderboard || []).map((e, idx) => (
            <div key={e.userId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{idx + 1}</span>
                <span className="font-medium">{e.fullName}</span>
              </div>
              <span className="text-xs text-muted-foreground">{e.total_points} pts</span>
            </div>
          ))}
          {!isLoading && (data?.leaderboard || []).length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2" />
              No leaderboard data yet.
            </div>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
