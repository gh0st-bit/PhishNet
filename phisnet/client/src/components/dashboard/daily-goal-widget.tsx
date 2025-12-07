import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Target, CalendarClock } from "lucide-react";

interface DailyGoalProps {
  target: number;
  completedToday: number;
  progress: number; // 0-100
  suggestion?: string;
  dueSoon?: { moduleId: number; title: string; dueDate: string | null } | null;
}

export function DailyGoalWidget({ target, completedToday, progress, suggestion, dueSoon }: DailyGoalProps) {
  return (
    <Card className="p-3 sm:p-4 lg:p-5 flex items-center gap-3 sm:gap-4">
      <div className="relative h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full">
          <path
            className="text-muted fill-none stroke-muted-foreground/20"
            strokeWidth="3"
            strokeLinecap="round"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="text-primary fill-none stroke-primary"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${progress}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-semibold">
          {progress}%
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
          <Target className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
          Daily Goal
        </div>
        <div className="text-base sm:text-lg lg:text-xl font-bold mt-0.5 sm:mt-1">{completedToday}/{target} completed</div>
        {suggestion && (
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">Suggestion: {suggestion}</div>
        )}
        {dueSoon && (
          <div className="text-[10px] sm:text-xs mt-0.5 sm:mt-1 flex items-center gap-1">
            <CalendarClock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-orange-500 shrink-0" />
            <span className="truncate">Due: {dueSoon.title}</span>
          </div>
        )}
      </div>
      <Button size="sm" variant="outline" className="hidden lg:inline-flex gap-1 shrink-0">
        <CheckCircle2 className="h-4 w-4" />
        Start
      </Button>
    </Card>
  );
}
