import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { Loader2, Trophy, Award, Video, ListChecks, Star, Users, AlertCircle, ExternalLink, Play, LogOut, Menu, BookOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

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
  const [activeTab, setActiveTab] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, navigate] = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  
  // Data queries
  const trainingQ = useEmployeeQuery<TrainingResponse>("training","/api/employee/training");
  const quizzesQ = useEmployeeQuery<QuizzesResponse>("quizzes","/api/employee/quizzes");
  const pointsQ = useEmployeeQuery<PointsResponse>("points","/api/employee/points");
  const badgesQ = useEmployeeQuery<BadgesResponse>("badges","/api/employee/badges");
  const leaderboardQ = useEmployeeQuery<LeaderboardResponse>("leaderboard","/api/employee/leaderboard");
  
  const hasError = trainingQ.isError || quizzesQ.isError || pointsQ.isError || badgesQ.isError || leaderboardQ.isError;
  
  // Filter training modules based on active tab
  const filteredModules = (trainingQ.data?.modules || []).filter(m => {
    if (activeTab === "active") return m.progressStatus === "in_progress";
    if (activeTab === "completed") return m.progressStatus === "completed";
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex">
      {/* Employee Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border
        transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <h2 className="text-xl font-bold">Employee Portal</h2>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <span className="sr-only">Close menu</span>×
            </Button>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setActiveTab('all'); setSidebarOpen(false); }}>
              <BookOpen className="mr-2 h-4 w-4" />
              My Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setActiveTab('active'); setSidebarOpen(false); }}>
              <Play className="mr-2 h-4 w-4" />
              Active Training
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setActiveTab('completed'); setSidebarOpen(false); }}>
              <ListChecks className="mr-2 h-4 w-4" />
              Completed
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setActiveTab('badges'); setSidebarOpen(false); }}>
              <Award className="mr-2 h-4 w-4" />
              My Badges
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { setActiveTab('leaderboard'); setSidebarOpen(false); }}>
              <Trophy className="mr-2 h-4 w-4" />
              Leaderboard
            </Button>
          </nav>

          <div className="p-4 border-t border-border">
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-x-hidden">
        <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Security Learning Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your progress, earn badges, and master cybersecurity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {trainingQ.refetch(); quizzesQ.refetch(); pointsQ.refetch(); badgesQ.refetch(); leaderboardQ.refetch();}} 
            disabled={trainingQ.isLoading}
          >
            {trainingQ.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden lg:flex gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      
      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load some data. Please refresh or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
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

      {/* Main Content Sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Upcoming / Active Training */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video className="h-5 w-5 text-blue-500" />
                Training Modules
              </h2>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="grid grid-cols-3 w-full sm:w-[280px]">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="completed">Done</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {trainingQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredModules.slice(0,6).map(m => (
                  <div key={m.id} className="group border rounded-lg p-4 bg-card hover:shadow-md hover:border-primary/50 transition-all cursor-pointer">
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
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
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
                      <Button size="sm" variant="outline" className="gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {q.bestScore ? 'Retake' : 'Start'}
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
              <div className="grid grid-cols-3 gap-3">
                {(badgesQ.data?.badges||[]).slice(0,9).map(b => {
                  const rarityColor = b.rarity === 'legendary' ? 'text-yellow-500' : 
                                     b.rarity === 'epic' ? 'text-purple-500' : 
                                     b.rarity === 'rare' ? 'text-blue-500' : 'text-gray-500';
                  return (
                    <div 
                      key={b.id} 
                      className={`group relative flex flex-col items-center gap-2 text-center p-3 rounded-lg border transition-all ${
                        b.earned 
                          ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary shadow-sm hover:shadow-md' 
                          : 'bg-muted/20 border-muted hover:border-muted-foreground/30 opacity-60'
                      }`}
                      title={b.name}
                    > 
                      <Trophy className={`h-6 w-6 ${b.earned ? rarityColor : 'text-muted-foreground/50'} transition group-hover:scale-110`} />
                      <span className="text-[10px] font-medium leading-tight line-clamp-2">{b.name}</span>
                      {b.earned && <span className="absolute -top-1 -right-1 text-xs">✓</span>}
                    </div>
                  );
                })}
                {!(badgesQ.data?.badges||[]).length && (
                  <div className="col-span-3 text-center py-8">
                    <Award className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">No badges defined.</p>
                  </div>
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
      <Card className="p-5">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/employee/training">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
              <Video className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium text-sm">Browse Training</div>
                <div className="text-xs text-muted-foreground">View all modules</div>
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
                <div className="font-medium text-sm">Certificates</div>
                <div className="text-xs text-muted-foreground">View earned certs</div>
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
      </div>
      </div>
    </div>
  );
}
