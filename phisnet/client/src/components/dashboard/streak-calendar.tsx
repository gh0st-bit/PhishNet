import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Flame } from 'lucide-react';

interface StreakData {
  date: string;
  active: boolean;
}

interface StreakCalendarProps {
  streakData?: StreakData[] | null;
  currentStreak?: number;
  maxStreak?: number;
}

export function StreakCalendar({ streakData, currentStreak = 0, maxStreak = 0 }: StreakCalendarProps) {
  const safeData = Array.isArray(streakData) ? streakData : [];
  // Group by weeks
  const weeks: StreakData[][] = [];
  for (let i = 0; i < safeData.length; i += 7) {
    weeks.push(safeData.slice(i, i + 7));
  }

  const getIntensityClass = (active: boolean) => {
    if (!active) return 'bg-muted';
    return 'bg-green-500 dark:bg-green-600';
  };

  return (
    <Card>
      <CardHeader className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
              <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
              <span className="truncate">Learning Streak</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Keep your momentum going!</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl sm:text-2xl font-bold text-orange-500">{currentStreak}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Current</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Longest Streak</span>
            <span className="font-semibold">{maxStreak} days</span>
          </div>
          
          <div className="space-y-0.5 sm:space-y-1">
            {weeks.length === 0 && (
              <div className="text-[10px] sm:text-xs text-muted-foreground">No streak data yet</div>
            )}
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex gap-0.5 sm:gap-1">
                {week.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm ${getIntensityClass(day.active)} transition-colors`}
                    title={`${day.date}: ${day.active ? 'Active' : 'Inactive'}`}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm bg-muted shrink-0" />
              <span>No activity</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm bg-green-500 shrink-0" />
              <span>Active</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
