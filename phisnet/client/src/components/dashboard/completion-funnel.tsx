import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingDown } from 'lucide-react';

interface FunnelData {
  started: number;
  inProgress: number;
  completed: number;
}

interface CompletionFunnelProps {
  data?: FunnelData;
  title?: string;
  description?: string;
}

export function CompletionFunnel({ 
  data, 
  title = "Learning Journey",
  description = "Your progress through training modules"
}: CompletionFunnelProps) {
  const safe = data ?? { started: 0, inProgress: 0, completed: 0 };
  const total = safe.started + safe.inProgress + safe.completed;
  const completionRate = total > 0 ? Math.round((safe.completed / total) * 100) : 0;

  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="truncate">{title}</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-4 sm:space-y-6">
          {/* Completion Rate */}
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-primary">{completionRate}%</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Completion Rate</div>
          </div>

          {/* Funnel Stages */}
          <div className="space-y-4">
            {/* Started */}
            <div>
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-[11px] sm:text-sm font-medium">Started</span>
                <span className="text-[11px] sm:text-sm text-muted-foreground">{safe.started} modules</span>
              </div>
              <Progress value={100} className="h-2 sm:h-2.5" />
            </div>

            {/* In Progress */}
            <div>
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-[11px] sm:text-sm font-medium">In Progress</span>
                <span className="text-[11px] sm:text-sm text-muted-foreground">{safe.inProgress} modules</span>
              </div>
              <Progress 
                value={total > 0 ? (safe.inProgress / total) * 100 : 0} 
                className="h-2 sm:h-2.5" 
              />
            </div>

            {/* Completed */}
            <div>
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-[11px] sm:text-sm font-medium">Completed</span>
                <span className="text-[11px] sm:text-sm text-muted-foreground">{safe.completed} modules</span>
              </div>
              <Progress 
                value={total > 0 ? (safe.completed / total) * 100 : 0} 
                className="h-2 sm:h-2.5"
              />
            </div>
          </div>

          {/* Insights */}
          {safe.inProgress > 0 && (
            <div className="p-2 sm:p-3 rounded-lg bg-muted">
              <div className="flex items-start gap-1.5 sm:gap-2">
                <Target className="h-3 w-3 sm:h-4 sm:w-4 text-primary mt-0.5" />
                <div className="text-[11px] sm:text-xs leading-relaxed">
                  <span className="font-medium">Keep going!</span>{' '}
                  Complete {safe.inProgress} in-progress module{safe.inProgress !== 1 ? 's' : ''} to boost your score.
                </div>
              </div>
            </div>
          )}
          {total === 0 && (
            <div className="text-[10px] sm:text-xs text-muted-foreground text-center py-2">No module activity yet</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
