import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface Badge {
  id: number;
  name: string;
  description?: string;
  rarity?: string;
}

interface CelebrationModalProps {
  open: boolean;
  onClose: () => void;
  type: 'level-up' | 'badge' | 'milestone';
  data: {
    // For level-up
    oldLevel?: number;
    newLevel?: number;
    // For badge
    badge?: Badge;
    // For milestone
    milestone?: {
      name: string;
      description: string;
    };
  };
}

export function CelebrationModal({ open, onClose, type, data }: CelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      // Optionally trigger canvas-confetti here if installed
      // confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      setShowConfetti(false);
    }
  }, [open]);

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-amber-600';
      case 'epic': return 'from-purple-400 to-purple-600';
      case 'rare': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="relative">
          {/* Celebration Effects */}
          {showConfetti && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Simple CSS animation sparkles */}
              <div className="absolute top-0 left-1/4 animate-bounce">
                <Sparkles className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="absolute top-2 right-1/4 animate-bounce delay-100">
                <Sparkles className="h-3 w-3 text-blue-500" />
              </div>
              <div className="absolute top-4 left-3/4 animate-bounce delay-200">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          )}

          <DialogHeader>
            <div className="flex flex-col items-center text-center space-y-4 pt-6">
              {/* Icon based on type */}
              {type === 'level-up' && (
                <div className="p-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 animate-pulse">
                  <Star className="h-12 w-12 text-white" />
                </div>
              )}
              {type === 'badge' && data.badge && (
                <div className={`p-4 rounded-full bg-gradient-to-br ${getRarityColor(data.badge.rarity)} animate-pulse`}>
                  <Trophy className="h-12 w-12 text-white" />
                </div>
              )}
              {type === 'milestone' && (
                <div className="p-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 animate-pulse">
                  <Sparkles className="h-12 w-12 text-white" />
                </div>
              )}

              <DialogTitle className="text-3xl font-bold">
                {type === 'level-up' && 'Level Up!'}
                {type === 'badge' && 'Achievement Unlocked!'}
                {type === 'milestone' && 'Milestone Reached!'}
              </DialogTitle>

              <DialogDescription className="text-base space-y-2">
                {type === 'level-up' && data.oldLevel && data.newLevel && (
                  <div>
                    <p className="text-2xl font-bold text-foreground mb-2">
                      Level {data.oldLevel} → Level {data.newLevel}
                    </p>
                    <p className="text-muted-foreground">
                      Congratulations on reaching Level {data.newLevel}! Keep up the great work.
                    </p>
                  </div>
                )}
                
                {type === 'badge' && data.badge && (
                  <div>
                    <p className="text-xl font-bold text-foreground mb-1">
                      {data.badge.name}
                    </p>
                    {data.badge.description && (
                      <p className="text-muted-foreground mb-2">
                        {data.badge.description}
                      </p>
                    )}
                    {data.badge.rarity && (
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${getRarityColor(data.badge.rarity)}`}>
                        {data.badge.rarity}
                      </span>
                    )}
                  </div>
                )}
                
                {type === 'milestone' && data.milestone && (
                  <div>
                    <p className="text-xl font-bold text-foreground mb-1">
                      {data.milestone.name}
                    </p>
                    <p className="text-muted-foreground">
                      {data.milestone.description}
                    </p>
                  </div>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex justify-center mt-6 pb-4">
            <Button onClick={onClose} size="lg" className="min-w-[120px]">
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
