import AppLayout from '@/components/layout/app-layout';
import {RefreshButton} from '@/components/ui/refresh-button';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { Loader2, Trophy, Award, Video, ListChecks, Star, Users, AlertCircle, ExternalLink, Play, BookOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useLocation } from "wouter";
import { LearningTrendChart } from "@/components/dashboard/learning-trend-chart";
import { SkillRadarChart } from "@/components/dashboard/skill-radar-chart";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { StreakCalendar } from "@/components/dashboard/streak-calendar";
import { CompletionFunnel } from "@/components/dashboard/completion-funnel";
import { QuizPerformanceLine } from "@/components/dashboard/quiz-performance-line";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { RecommendedContent } from "@/components/dashboard/recommended-content";
import { DailyGoalWidget } from "@/components/dashboard/daily-goal-widget";
import { AchievementHighlights } from "@/components/dashboard/achievement-highlights";
import { LearningInsights } from "@/components/dashboard/learning-insights";
import { LevelProgressWidget } from "@/components/dashboard/level-progress-widget";

// Production-ready theme toggle using next-themes
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
      aria-label="Toggle theme"
      className="gap-2"
    >
      {theme === "dark" ? "☀️" : "🌙"}
      <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
    </Button>
  );
}

interface TrainingModuleProgress {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  progressPercentage: number | null;
  progressStatus: string | null;
  completedAt: string | null;
  dueDate: string | null;
}

interface QuizSummary {
  id: number;
  title: string;
  bestScore?: number;
  passingScore?: number;
}

interface PointsInfo {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
}

interface BadgeInfo {
  id: number;
  name: string;
  earned: boolean;
  rarity: string;
}

interface LeaderboardEntry {
  id: number;
  first_name: string;
  last_name: string;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  badge_count: number;
  rank: number;
}

// API response wrappers
interface TrainingResponse {
  modules: TrainingModuleProgress[];
}

interface QuizzesResponse {
  quizzes: QuizSummary[];
}

interface BadgesResponse {
  badges: BadgeInfo[];
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

interface PointsResponse {
  points: PointsInfo;
}

function useEmployeeQuery<T>(key: string, url: string) {
  return useQuery<T>({
    queryKey: [url],
    queryFn: async () => {
      const res = await apiRequest("GET", url);
      if (!res.ok) {
        const error = await res.text().catch(() => 'Unknown error');
        throw new Error(error || `Failed fetching ${url}`);
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000, // 30 seconds
  });
}

export default function EmployeeDashboardPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("all");
  // Data queries
  const trainingQ = useEmployeeQuery<TrainingResponse>("training","/api/employee/training");
  const quizzesQ = useEmployeeQuery<QuizzesResponse>("quizzes","/api/employee/quizzes");
  const pointsQ = useEmployeeQuery<PointsResponse>("points","/api/employee/points");
  const badgesQ = useEmployeeQuery<BadgesResponse>("badges","/api/employee/badges");
  const leaderboardQ = useEmployeeQuery<LeaderboardResponse>("leaderboard","/api/employee/leaderboard");
  
  // New analytics query
  const analyticsQ = useQuery({
    queryKey: ["/api/employee/dashboard/analytics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employee/dashboard/analytics");
      if (!res.ok) {
        const error = await res.text().catch(() => 'Unknown error');
        throw new Error(error || 'Failed fetching analytics');
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Insights widgets query
  const insightsQ = useQuery({
    queryKey: ["/api/employee/dashboard/insights"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employee/dashboard/insights");
      if (!res.ok) {
        const error = await res.text().catch(() => 'Unknown error');
        throw new Error(error || 'Failed fetching insights');
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Level query
  const levelQ = useQuery({
    queryKey: ["/api/employee/level"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employee/level");
      if (!res.ok) {
        const error = await res.text().catch(() => 'Unknown error');
        throw new Error(error || 'Failed fetching level');
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000,
  });
  
  const hasError = trainingQ.isError || quizzesQ.isError || pointsQ.isError || badgesQ.isError || leaderboardQ.isError || analyticsQ.isError || insightsQ.isError || levelQ.isError;
  
  // Filter training modules based on active tab
  const filteredModules = (trainingQ.data?.modules || []).filter(m => {
    if (activeTab === "active") return m.progressStatus === "in_progress";
    if (activeTab === "completed") return m.progressStatus === "completed";
    return true;
  });

  const queries=[trainingQ,quizzesQ,pointsQ,badgesQ,leaderboardQ,analyticsQ,insightsQ,levelQ];
  return <AppLayout><div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl md:text-3xl font-bold">Security Learning Portal</h1><p className="text-sm text-muted-foreground">Your learning, achievements and practice inbox in one workspace.</p></div>
      <div className="flex gap-2"><ThemeToggle/><RefreshButton onRefresh={()=>Promise.all(queries.map(q=>q.refetch({throwOnError:true})))}>Refresh dashboard</RefreshButton></div>
    </div>
    <Card className="p-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">My inbox</h2><p className="text-sm text-muted-foreground">Open your existing practice messages and review their details.</p></div><Link href="/employee/inbox"><Button>Open my inbox</Button></Link></Card>
      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load some data. Please refresh or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Overview */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 lg:p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Video className="h-4 w-4 text-blue-500" />
            Training Progress
          </div>
          {pointsQ.isLoading || trainingQ.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
            <div className="text-3xl font-bold">
              {(() => {
                const modules = trainingQ.data?.modules || [];
                const completed = modules.filter(m => m.progressStatus === 'completed').length;
                return `${completed}/${modules.length}`;
              })()}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Completed modules</p>
        </Card>
        <Card className="p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ListChecks className="h-4 w-4 text-green-500" />
            Quiz Performance
          </div>
          {quizzesQ.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
            <div className="text-3xl font-bold">
              {(() => {
                const quizzes = quizzesQ.data?.quizzes || [];
                if (!quizzes.length) return '—';
                const avg = quizzes.reduce((acc,q)=> acc + (q.bestScore || 0),0)/quizzes.length;
                return `${Math.round(avg)}%`;
              })()}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Average best score</p>
        </Card>
        <Card className="p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Points
          </div>
          {pointsQ.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
            <div className="text-3xl font-bold">{pointsQ.data?.points?.totalPoints ?? 0}</div>
          )}
          <p className="text-xs text-muted-foreground">Total gamification points</p>
        </Card>
        <Card className="p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="h-4 w-4 text-orange-500" />
            Streak
          </div>
          {pointsQ.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
            <div className="text-3xl font-bold">{pointsQ.data?.points?.currentStreak ?? 0}<span className="text-lg ml-1">days</span></div>
          )}
          <p className="text-xs text-muted-foreground">Current learning streak</p>
        </Card>
      </div>

      {/* Smart Insights */}
      {(insightsQ.data || levelQ.data) && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {insightsQ.data?.dailyGoal && (
            <DailyGoalWidget 
              target={insightsQ.data.dailyGoal.target}
              completedToday={insightsQ.data.dailyGoal.completedToday}
              progress={insightsQ.data.dailyGoal.progress}
              suggestion={insightsQ.data.dailyGoal.suggestion}
              dueSoon={insightsQ.data.dailyGoal.dueSoon}
            />
          )}
          {levelQ.data?.levelProgress && (
            <LevelProgressWidget 
              level={levelQ.data.levelProgress.level}
              currentLevelXP={levelQ.data.levelProgress.currentLevelXP}
              nextLevelXP={levelQ.data.levelProgress.nextLevelXP}
              progress={levelQ.data.levelProgress.progress}
              totalPoints={levelQ.data.totalPoints}
            />
          )}
          {insightsQ.data?.achievements && (
            <AchievementHighlights 
              recent={insightsQ.data.achievements.recent}
              total={insightsQ.data.achievements.total}
            />
          )}
          {insightsQ.data?.insights && (
            <LearningInsights 
              topCategory={insightsQ.data.insights.topCategory}
              weakArea={insightsQ.data.insights.weakArea}
              milestone={insightsQ.data.milestone}
            />
          )}
        </div>
      )}

      {/* Analytics Visualizations */}
      {analyticsQ.data && (
        <div className="space-y-6">
          {/* Trends and Activity Row */}
          <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
            {analyticsQ.data.trends && analyticsQ.data.trends.length > 0 && (
              <LearningTrendChart data={analyticsQ.data.trends} />
            )}
            {analyticsQ.data.heatmap && analyticsQ.data.heatmap.length > 0 && (
              <ActivityHeatmap data={analyticsQ.data.heatmap} />
            )}
          </div>

          {/* Skills and Performance Row */}
          <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">
            {analyticsQ.data.skills && analyticsQ.data.skills.length > 0 && (
              <SkillRadarChart data={analyticsQ.data.skills} />
            )}
            {analyticsQ.data.quizTrends && analyticsQ.data.quizTrends.length > 0 && (
              <QuizPerformanceLine data={analyticsQ.data.quizTrends} />
            )}
          </div>

          {/* Insights and Actions Row */}
          <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {analyticsQ.data.streakHistory && (
              <StreakCalendar 
                streakData={analyticsQ.data.streakHistory.streakData}
                currentStreak={analyticsQ.data.streakHistory.currentStreak}
                maxStreak={analyticsQ.data.streakHistory.maxStreak}
              />
            )}
            {analyticsQ.data.funnel && (
              <CompletionFunnel data={analyticsQ.data.funnel} />
            )}
            {analyticsQ.data.deadlines && (
              <UpcomingDeadlines deadlines={analyticsQ.data.deadlines} />
            )}
          </div>

          {/* Recommendations */}
          {analyticsQ.data.recommendations && (
            <RecommendedContent 
              modules={analyticsQ.data.recommendations.modules || []}
              articles={analyticsQ.data.recommendations.articles || []}
            />
          )}
        </div>
      )}

      {/* Main Content Sections */}
      <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="space-y-4 lg:space-y-6 lg:col-span-2">
          {/* Upcoming / Active Training */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video className="h-5 w-5 text-blue-500" />
                Training Modules
              </h2>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="grid grid-cols-3 w-full max-w-[280px]">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs sm:text-sm">Active</TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs sm:text-sm">Done</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {trainingQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredModules.slice(0,6).map(m => (
                  <div key={m.id} className="group border rounded-lg p-3 sm:p-4 bg-card hover:shadow-md hover:border-primary/50 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition">{m.title}</h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${
                        m.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        m.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>{m.difficulty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span className="px-2 py-0.5 rounded bg-muted">{m.category}</span>
                      {m.progressStatus === 'completed' && <span className="text-green-600 dark:text-green-400 font-medium">✓ Completed</span>}
                    </div>
                    <div className="space-y-2">
                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300" 
                          style={{width: `${m.progressPercentage ?? 0}%`}} 
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium">{m.progressPercentage ?? 0}% complete</span>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => navigate(`/employee/training/${m.id}`)}>
                          <Play className="h-3 w-3" />
                          {!m.progressStatus || m.progressStatus === 'not_started' ? 'Start' : m.progressStatus === 'completed' ? 'Review' : 'Continue'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!filteredModules.length && (
                  <div className="col-span-2 text-center py-12">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No {activeTab === 'all' ? '' : activeTab} modules {activeTab === 'all' ? 'assigned yet' : 'found'}.</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Quiz Performance */}
          <Card className="p-5">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <ListChecks className="h-5 w-5 text-green-500" />
              Knowledge Checks
            </h2>
            {quizzesQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
              </div>
            ) : (
              <div className="space-y-3">
                {(quizzesQ.data?.quizzes || []).slice(0,5).map(q => {
                  const passed = (q.bestScore ?? 0) >= (q.passingScore ?? 80);
                  return (
                    <div key={q.id} className="group border rounded-lg p-4 bg-card flex items-center justify-between hover:shadow-md hover:border-primary/50 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold line-clamp-1 group-hover:text-primary transition">{q.title}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Best: <span className={`font-semibold ${passed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {q.bestScore ?? '—'}%
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">Pass: {q.passingScore ?? 80}%</span>
                          {passed && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">✓ Passed</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate(`/employee/quizzes/${q.id}`)}>
                        <ExternalLink className="h-3 w-3" />
                        {q.bestScore != null ? 'Retake' : 'Start'}
                      </Button>
                    </div>
                  );
                })}
                {!(quizzesQ.data?.quizzes||[]).length && (
                  <div className="text-center py-12">
                    <ListChecks className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No quizzes available yet.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar: Achievements & Leaderboard */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-500" />
                Achievements
              </h2>
              <span className="text-xs text-muted-foreground">
                {(badgesQ.data?.badges||[]).filter(b => b.earned).length}/{(badgesQ.data?.badges||[]).length}
              </span>
            </div>
            {badgesQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {(badgesQ.data?.badges||[])
                    .sort((a, b) => {
                      // Show earned first, then sort by rarity
                      if (a.earned !== b.earned) return b.earned ? 1 : -1;
                      const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
                      return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
                    })
                    .slice(0,9).map(b => {
                    const rarityColor = b.rarity === 'legendary' ? 'text-yellow-500' : 
                                       b.rarity === 'epic' ? 'text-purple-500' : 
                                       b.rarity === 'rare' ? 'text-blue-500' : 'text-gray-500';
                    return (
                      <Link href={`/employee/badges/${b.id}`}
                        key={b.id} 
                        className={`group relative flex flex-col items-center gap-2 text-center p-3 rounded-lg border transition-all cursor-pointer ${
                          b.earned 
                            ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary shadow-sm hover:shadow-md' 
                            : 'bg-muted/20 border-muted hover:border-muted-foreground/30 opacity-60'
                        }`}
                        title={b.name}
                      > 
                        <Trophy className={`h-6 w-6 ${b.earned ? rarityColor : 'text-muted-foreground/50'} transition group-hover:scale-110`} />
                        <span className="text-[10px] font-medium leading-tight line-clamp-2">{b.name}</span>
                        {b.earned && <span className="absolute -top-1 -right-1 text-xs">✓</span>}
                      </Link>
                    );
                  })}
                  {!(badgesQ.data?.badges||[]).length && (
                    <div className="col-span-3 text-center py-8">
                      <Award className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs text-muted-foreground">No badges defined.</p>
                    </div>
                  )}
                </div>
                {(badgesQ.data?.badges||[]).length > 9 && (
                  <Link href="/employee/badges">
                    <Button variant="outline" size="sm" className="w-full">
                      View All Badges
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Leaderboard
              </h2>
              <span className="text-xs text-muted-foreground">Top 10</span>
            </div>
            {leaderboardQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
              </div>
            ) : (
              <div className="space-y-2">
                {(leaderboardQ.data?.leaderboard||[]).slice(0,10).map((entry, idx) => {
                  const isTop3 = idx < 3;
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                  const fullName = `${entry.first_name} ${entry.last_name}`;
                  return (
                    <div 
                      key={entry.id} 
                      className={`flex items-center justify-between text-sm border rounded-lg px-3 py-2 transition-all ${
                        isTop3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border-yellow-300 dark:border-yellow-700' : 'bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shrink-0 ${
                          isTop3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {medal || `#${entry.rank}`}
                        </span>
                        <span className="font-medium truncate">{fullName}</span>
                      </div>
                      <span className="text-xs font-bold whitespace-nowrap ml-2">{entry.total_points} pts</span>
                    </div>
                  );
                })}
                {!(leaderboardQ.data?.leaderboard||[]).length && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-lg sm:text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Link href="/employee/training">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-2 sm:py-3">
              <Video className="h-4 w-4 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-medium text-xs sm:text-sm truncate">Browse Training</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">View all modules</div>
              </div>
            </Button>
          </Link>
          <Link href="/employee/quizzes">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
              <ListChecks className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium text-sm">Take Quiz</div>
                <div className="text-xs text-muted-foreground">Test your knowledge</div>
              </div>
            </Button>
          </Link>
          <Link href="/employee/badges">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
              <Award className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium text-sm">Achievements</div>
                <div className="text-xs text-muted-foreground">View earned badges</div>
              </div>
            </Button>
          </Link>
          <Link href="/employee/profile">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
              <Users className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium text-sm">My Profile</div>
                <div className="text-xs text-muted-foreground">Stats & settings</div>
              </div>
            </Button>
          </Link>
        </div>
      </Card>
      </div></AppLayout>;
}
