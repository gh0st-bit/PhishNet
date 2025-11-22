import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface Achievement {
  badgeId: number;
  name: string;
  rarity?: string | null;
  iconUrl?: string | null;
  earnedAt: string;
}

interface Props {
  recent: Achievement[];
  total: number;
}

export function AchievementHighlights({ recent, total }: Props) {
  return (
    <Card className="p-3 sm:p-4 lg:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
          <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 shrink-0" />
          <span className="truncate">Recent Achievements</span>
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{total} total</div>
      </div>
      {recent.length === 0 ? (
        <div className="text-xs sm:text-sm text-muted-foreground">No achievements yet. Keep going!</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {recent.map((a) => {
            const rarityColor = a.rarity === 'legendary' ? 'text-yellow-500' :
              a.rarity === 'epic' ? 'text-purple-500' :
              a.rarity === 'rare' ? 'text-blue-500' : 'text-muted-foreground';
            return (
              <div key={a.badgeId} className="border rounded-lg p-2 sm:p-3 text-center">
                {a.iconUrl ? (
                  <img src={a.iconUrl} alt={a.name} className="h-5 w-5 sm:h-6 sm:w-6 mx-auto" />
                ) : (
                  <Trophy className={`h-5 w-5 sm:h-6 sm:w-6 mx-auto ${rarityColor}`} />
                )}
                <div className="text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 line-clamp-2" title={a.name}>{a.name}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
