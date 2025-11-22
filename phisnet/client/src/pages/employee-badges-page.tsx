import AppLayout from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Award, ChevronRight, Trophy, Target, Flame, Star, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

interface Badge {
  id: number;
  name: string;
  description?: string;
  rarity?: string;
  earned?: boolean;
  earnedAt?: string | null;
  criteria?: Record<string, any>;
}

interface BadgesResponse {
  badges: Badge[];
}

interface LevelStatus {
  level: number;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
}

const BADGE_CATEGORIES = {
  all: { label: 'All Badges', icon: Award },
  milestone: { label: 'Milestones', icon: Target },
  streak: { label: 'Streaks', icon: Flame },
  mastery: { label: 'Mastery', icon: Star },
  special: { label: 'Special', icon: Trophy },
};

export default function EmployeeBadgesPage() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof BADGE_CATEGORIES>('all');
  
  const badgesQ = useQuery<BadgesResponse>({
    queryKey: ["/api/employee/badges"],
    queryFn: async () => {
      const res = await fetch("/api/employee/badges");
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    },
    staleTime: 30000,
  });

  const levelQ = useQuery<LevelStatus>({
    queryKey: ["/api/employee/level"],
    queryFn: async () => {
      const res = await fetch("/api/employee/level");
      if (!res.ok) throw new Error("Failed to fetch level");
      return res.json();
    },
    staleTime: 30000,
  });

  const categorizedBadges = useMemo(() => {
    const badges = badgesQ.data?.badges || [];
    return {
      milestone: badges.filter(b => 
        b.criteria?.type === 'total_points' || b.criteria?.type === 'points'
      ),
      streak: badges.filter(b => 
        b.criteria?.type === 'streak'
      ),
      mastery: badges.filter(b => 
        b.criteria?.type === 'quiz_completion' || b.criteria?.type === 'perfect_score'
      ),
      special: badges.filter(b => 
        b.criteria?.type === 'special' || 
        (!b.criteria?.type && !['total_points', 'points', 'streak', 'quiz_completion', 'perfect_score'].includes(b.criteria?.type))
      ),
    };
  }, [badgesQ.data]);

  const displayedBadges = useMemo(() => {
    if (selectedCategory === 'all') {
      return badgesQ.data?.badges || [];
    }
    return categorizedBadges[selectedCategory] || [];
  }, [selectedCategory, badgesQ.data, categorizedBadges]);

  const featuredBadges = useMemo(() => {
    const badges = badgesQ.data?.badges || [];
    const earned = badges.filter(b => b.earned);
    // Show rarest earned or highest value unearned
    return earned
      .sort((a, b) => {
        const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return (rarityOrder[b.rarity || 'common'] || 0) - (rarityOrder[a.rarity || 'common'] || 0);
      })
      .slice(0, 3);
  }, [badgesQ.data]);

  const calculateProgress = (badge: Badge): { progress: number; label: string } | null => {
    if (badge.earned || !badge.criteria || !levelQ.data) return null;

    const { type } = badge.criteria;
    const userStats = levelQ.data;

    if (type === 'total_points' || type === 'points') {
      const required = badge.criteria.points || badge.criteria.requiredPoints || 0;
      const current = userStats.totalPoints;
      const progress = Math.min((current / required) * 100, 100);
      return { progress, label: `${current}/${required} XP` };
    }

    if (type === 'streak') {
      const required = badge.criteria.days || badge.criteria.requiredDays || 0;
      const current = userStats.currentStreak;
      const progress = Math.min((current / required) * 100, 100);
      return { progress, label: `${current}/${required} days` };
    }

    // For quiz/mastery badges, we can't calculate progress without quiz data
    return null;
  };

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-amber-600';
      case 'epic': return 'from-purple-400 to-purple-600';
      case 'rare': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityTextColor = (rarity?: string) => {
    switch (rarity) {
      case 'legendary': return 'text-yellow-500';
      case 'epic': return 'text-purple-500';
      case 'rare': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Badges</h1>
        <p className="text-sm text-muted-foreground">
          {(badgesQ.data?.badges || []).filter(b => b.earned).length}/{(badgesQ.data?.badges || []).length} achievements unlocked
        </p>
      </div>

      {/* Featured/Rarest Showcase */}
      {featuredBadges.length > 0 && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Featured Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredBadges.map(badge => (
              <div 
                key={badge.id}
                className="flex flex-col items-center text-center p-4 rounded-lg bg-card/80 backdrop-blur border border-border/50 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => setLocation(`/employee/badges/${badge.id}`)}
              >
                <div className={`p-3 rounded-full bg-gradient-to-br ${getRarityColor(badge.rarity)} mb-3 group-hover:scale-110 transition-transform`}>
                  <Trophy className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold mb-1">{badge.name}</h3>
                <UIBadge variant="secondary" className={`text-xs mb-2 ${getRarityTextColor(badge.rarity)}`}>
                  {badge.rarity || 'common'}
                </UIBadge>
                <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
                {badge.earnedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Earned {new Date(badge.earnedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(BADGE_CATEGORIES).map(([key, { label, icon: Icon }]) => {
          const count = key === 'all' 
            ? (badgesQ.data?.badges || []).length 
            : (categorizedBadges[key as keyof typeof categorizedBadges] || []).length;
          return (
            <Button
              key={key}
              variant={selectedCategory === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(key as keyof typeof BADGE_CATEGORIES)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="text-xs opacity-70">({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Badge Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayedBadges.map((badge) => {
          const progress = calculateProgress(badge);
          return (
            <Card 
              key={badge.id} 
              className={`p-5 hover:shadow-lg transition-all cursor-pointer ${
                badge.earned ? 'border-primary/30' : 'opacity-75'
              }`} 
              onClick={() => setLocation(`/employee/badges/${badge.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  badge.earned 
                    ? `bg-gradient-to-br ${getRarityColor(badge.rarity)}` 
                    : 'bg-muted relative'
                }`}>
                  {badge.earned ? (
                    <Trophy className="h-5 w-5 text-white" />
                  ) : (
                    <>
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {badge.name}
                    {badge.earned ? (
                      <UIBadge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        Earned
                      </UIBadge>
                    ) : (
                      <UIBadge variant="secondary" className="text-xs">
                        Locked
                      </UIBadge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {badge.description || 'No description'}
                  </div>
                  
                  {/* Progress Indicator for Locked Badges */}
                  {progress && !badge.earned && (
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{progress.label}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all"
                          style={{ width: `${progress.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {badge.earnedAt && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          );
        })}
        {!badgesQ.isLoading && displayedBadges.length === 0 && (
          <Card className="p-6 col-span-full text-center text-sm text-muted-foreground">
            No badges in this category yet.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
