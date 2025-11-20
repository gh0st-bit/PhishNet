import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

interface PointsInfo {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
}

interface PointsResponse {
  points: PointsInfo;
}

export default function EmployeeProfilePage() {
  const { data } = useQuery<PointsResponse>({
    queryKey: ["/api/employee/points"],
    queryFn: async () => {
      const res = await fetch("/api/employee/points");
      if (!res.ok) throw new Error("Failed to fetch points");
      return res.json();
    },
    staleTime: 30000,
  });

  const points = data?.points;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Your stats and settings</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Points</div>
          <div className="text-2xl font-bold mt-1">{points?.totalPoints ?? 0}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Current Streak</div>
          <div className="text-2xl font-bold mt-1">{points?.currentStreak ?? 0} days</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Longest Streak</div>
          <div className="text-2xl font-bold mt-1">{points?.longestStreak ?? 0} days</div>
        </Card>
      </div>
    </AppLayout>
  );
}
