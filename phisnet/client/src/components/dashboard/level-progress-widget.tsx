import { Card } from "@/components/ui/card";
import { Trophy, Star, TrendingUp } from "lucide-react";

interface Props {
  level: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progress: number; // 0-100
  totalPoints: number;
}

export function LevelProgressWidget({ level, currentLevelXP, nextLevelXP, progress, totalPoints }: Props) {
  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
          <Star className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
          <span className="truncate">Level Progress</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
          <span className="text-[10px] sm:text-xs text-muted-foreground">{totalPoints} XP</span>
        </div>
      </div>
      
      <div className="flex items-baseline gap-1.5 sm:gap-2 mb-2 sm:mb-3">
        <span className="text-2xl sm:text-3xl font-bold">Level {level}</span>
        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <div className="h-2 sm:h-3 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500" 
            style={{width: `${progress}%`}} 
          />
        </div>
        <div className="flex justify-between items-center text-[10px] sm:text-xs text-muted-foreground">
          <span>{currentLevelXP} XP</span>
          <span className="font-medium">{progress}%</span>
          <span>{nextLevelXP} XP</span>
        </div>
      </div>
    </Card>
  );
}
