import { Card } from "@/components/ui/card";
import { Lightbulb, Flag } from "lucide-react";

interface Props {
  topCategory?: string | null;
  weakArea?: string | null;
  milestone?: { currentPoints: number; nextAt: number; remaining: number } | null;
}

export function LearningInsights({ topCategory, weakArea, milestone }: Props) {
  return (
    <Card className="p-5">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        Learning Insights
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Strongest area:</span>{" "}
          <span className="font-medium">{topCategory || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Needs practice:</span>{" "}
          <span className="font-medium">{weakArea || '—'}</span>
        </div>
        {milestone && (
          <div className="flex items-center gap-2 pt-1">
            <Flag className="h-4 w-4 text-indigo-500" />
            <div>
              <div className="font-medium">Next milestone: {milestone.nextAt} pts</div>
              <div className="text-xs text-muted-foreground">{milestone.remaining} points to go</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
