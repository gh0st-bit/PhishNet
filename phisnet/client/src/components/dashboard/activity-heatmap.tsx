import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface HeatmapDay {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data?: HeatmapDay[];
  title?: string;
  description?: string;
}

export function ActivityHeatmap({ 
  data = [], 
  title = "Activity Heatmap",
  description = "Your learning activity over time"
}: ActivityHeatmapProps) {
  // Defensive group by weeks (7 days per week)
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  // Calculate max count for intensity scaling (avoid Math.max on empty)
  const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count), 1) : 1;
  const hasData = data.length > 0;

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-muted hover:bg-muted/80';
    const intensity = count / maxCount;
    if (intensity >= 0.75) return 'bg-green-600 dark:bg-green-500 hover:bg-green-700';
    if (intensity >= 0.5) return 'bg-green-500 dark:bg-green-400 hover:bg-green-600';
    if (intensity >= 0.25) return 'bg-green-400 dark:bg-green-300 hover:bg-green-500';
    return 'bg-green-300 dark:bg-green-200 hover:bg-green-400';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="truncate">{title}</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3 sm:space-y-4">
          {/* Heatmap Grid */}
          <div className="space-y-1 overflow-x-auto pb-1 sm:pb-2">
            {hasData && weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex gap-1">
                {week.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className={`h-3 w-3 sm:h-4 sm:w-4 rounded-[2px] ${getIntensityClass(day.count)} transition-colors duration-200 cursor-pointer`}
                    title={`${formatDate(day.date)}: ${day.count} activit${day.count === 1 ? 'y' : 'ies'}`}
                  />
                ))}
              </div>
            ))}
            {!hasData && (
              <div className="text-[10px] sm:text-xs text-muted-foreground py-4">No activity data yet</div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-muted-foreground">Less</span>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-[2px] bg-muted" />
              <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-[2px] bg-green-300 dark:bg-green-200" />
              <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-[2px] bg-green-400 dark:bg-green-300" />
              <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-[2px] bg-green-500 dark:bg-green-400" />
              <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-[2px] bg-green-600 dark:bg-green-500" />
            </div>
            <span className="text-muted-foreground">More</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2 border-t">
            <div className="text-center">
              <div className="text-sm sm:text-xl font-bold">{data.filter(d => d.count > 0).length}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Active Days</div>
            </div>
            <div className="text-center">
              <div className="text-sm sm:text-xl font-bold">{data.reduce((sum, d) => sum + d.count, 0)}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Total Activities</div>
            </div>
            <div className="text-center">
              <div className="text-sm sm:text-xl font-bold">{maxCount}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Busiest Day</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
