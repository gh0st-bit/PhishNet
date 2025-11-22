import { Trophy, Star, TrendingUp } from "lucide-react";
import type { ToastProps } from "@/components/ui/toast";

interface Badge {
  id: number;
  name: string;
  description?: string;
  rarity?: string;
}

interface LevelUpData {
  oldLevel: number;
  newLevel: number;
}

type ToastFunction = (props: Omit<ToastProps, "id"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
}) => { id: string; dismiss: () => void; update: (props: any) => void };

const getRarityConfig = (rarity?: string) => {
  switch (rarity) {
    case 'legendary':
      return { color: 'text-yellow-500', bgGradient: 'from-yellow-500/20 to-amber-600/20', borderColor: 'border-yellow-500/50' };
    case 'epic':
      return { color: 'text-purple-500', bgGradient: 'from-purple-500/20 to-purple-600/20', borderColor: 'border-purple-500/50' };
    case 'rare':
      return { color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/20', borderColor: 'border-blue-500/50' };
    default:
      return { color: 'text-gray-500', bgGradient: 'from-gray-500/20 to-gray-600/20', borderColor: 'border-gray-500/50' };
  }
};

export const showBadgeUnlockedToast = (toast: ToastFunction, badge: Badge) => {
  const { color, bgGradient, borderColor } = getRarityConfig(badge.rarity);
  
  toast({
    title: "🏆 Achievement Unlocked!",
    description: (
      <div className="space-y-1 mt-2">
        <p className="font-semibold">{badge.name}</p>
        {badge.description && (
          <p className="text-sm text-muted-foreground">{badge.description}</p>
        )}
        <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color} bg-gradient-to-r ${bgGradient} border ${borderColor} mt-1`}>
          {badge.rarity || 'common'}
        </div>
      </div>
    ),
    duration: 6000,
  });
};

export const showLevelUpToast = (toast: ToastFunction, data: LevelUpData) => {
  toast({
    title: "⭐ Level Up!",
    description: (
      <div className="space-y-1 mt-2">
        <p className="font-semibold text-lg">
          Level {data.oldLevel} → Level {data.newLevel}
        </p>
        <p className="text-sm text-muted-foreground">
          Congratulations on reaching a new level!
        </p>
      </div>
    ),
    duration: 5000,
  });
};

export const showXpGainedToast = (toast: ToastFunction, xp: number, reason: string) => {
  const reasonText = reason === 'training_completion' ? 'Training Completed' :
                     reason === 'quiz_completion' ? 'Quiz Completed' :
                     reason === 'perfect_score' ? 'Perfect Score!' :
                     'XP Gained';

  toast({
    title: `📈 ${reasonText}`,
    description: `+${xp} XP earned`,
    duration: 3000,
  });
};
