import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge as BadgeUI } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, Users, CheckCircle2, Target, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BadgeDetails {
  id: number;
  name: string;
  description: string;
  iconUrl?: string;
  category: string;
  criteria: any;
  pointsAwarded: number;
  rarity: string;
  earned: boolean;
  earnedAt: string | null;
  totalEarned: number;
  progress: number;
  progressDetails?: {
    current: number;
    required: number;
    type: string;
  };
}

interface BadgeResponse {
  badge: BadgeDetails;
}

const rarityColors: Record<string, string> = {
  common: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  rare: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300",
  epic: "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300",
  legendary: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
};

const categoryIcons: Record<string, any> = {
  milestone: TrendingUp,
  streak: Calendar,
  mastery: Target,
  special: Award,
};

export default function EmployeeBadgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const badgeId = Number.parseInt(id || "0");

  const { data, isLoading, error } = useQuery<BadgeResponse>({
    queryKey: [`/api/employee/badges/${badgeId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employee/badges/${badgeId}`);
      if (!res.ok) throw new Error("Failed to fetch badge details");
      return res.json();
    },
    enabled: !!badgeId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertDescription>Failed to load badge details. Please try again.</AlertDescription>
        </Alert>
        <Button onClick={() => setLocation("/employee/badges")} className="mt-4">
          Back to Badges
        </Button>
      </AppLayout>
    );
  }

  const { badge } = data;
  const CategoryIcon = categoryIcons[badge.category] || Award;

  const formatRequirement = (criteria: any) => {
    if (!criteria) return "No requirements specified";
    
    if (criteria.type === "points") {
      return `Earn ${criteria.requiredPoints} total points`;
    } else if (criteria.type === "quiz_completion") {
      return `Complete ${criteria.requiredCompletions} quiz${criteria.requiredCompletions !== 1 ? 'es' : ''} with passing score`;
    } else if (criteria.type === "streak") {
      return `Maintain a ${criteria.requiredDays}-day learning streak`;
    } else if (criteria.type === "perfect_score") {
      return `Achieve ${criteria.requiredCount} perfect score${criteria.requiredCount !== 1 ? 's' : ''} (100%)`;
    }
    
    return "Complete special requirements";
  };

  const formatProgressText = (details: any) => {
    if (!details) return "";
    
    if (details.type === "points") {
      return `${details.current.toLocaleString()} / ${details.required.toLocaleString()} points`;
    } else if (details.type === "quiz_completion") {
      return `${details.current} / ${details.required} quizzes completed`;
    } else if (details.type === "perfect_score") {
      return `${details.current} / ${details.required} perfect scores`;
    } else if (details.type === "streak") {
      return `${details.current} / ${details.required} days`;
    }
    
    return "";
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/employee/badges")}>
          ← Back to Badges
        </Button>

        {/* Main Badge Card */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Badge Icon */}
            <div className={`flex items-center justify-center w-32 h-32 rounded-full ${badge.earned ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-muted'} flex-shrink-0`}>
              <Award className={`h-16 w-16 ${badge.earned ? 'text-white' : 'text-muted-foreground'}`} />
            </div>

            {/* Badge Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">{badge.name}</h1>
                  {badge.earned && (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  )}
                </div>
                <p className="text-muted-foreground">{badge.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <BadgeUI className={rarityColors[badge.rarity] || rarityColors.common}>
                  {badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1)}
                </BadgeUI>
                <BadgeUI variant="outline" className="gap-1">
                  <CategoryIcon className="h-3 w-3" />
                  {badge.category}
                </BadgeUI>
                <BadgeUI variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {badge.pointsAwarded} points
                </BadgeUI>
                <BadgeUI variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {badge.totalEarned} earned
                </BadgeUI>
              </div>

              {badge.earned && badge.earnedAt && (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    You earned this badge on {new Date(badge.earnedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </Card>

        {/* Requirements Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Requirements
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatRequirement(badge.criteria)}
            </p>

            {!badge.earned && badge.progressDetails && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{badge.progress}%</span>
                </div>
                <Progress value={badge.progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {formatProgressText(badge.progressDetails)}
                </p>
              </div>
            )}

            {badge.earned && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Completed</span>
              </div>
            )}
          </div>
        </Card>

        {/* Criteria Details Card */}
        {badge.criteria && Object.keys(badge.criteria).length > 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Criteria Details</h2>
            <div className="space-y-2">
              {Object.entries(badge.criteria).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Stats Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{badge.totalEarned}</p>
              <p className="text-sm text-muted-foreground">Users earned this badge</p>
            </div>
            <div>
              <p className="text-2xl font-bold capitalize">{badge.rarity}</p>
              <p className="text-sm text-muted-foreground">Rarity level</p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
