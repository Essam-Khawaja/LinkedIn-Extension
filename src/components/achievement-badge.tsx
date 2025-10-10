import { Check, Lock } from "lucide-react";

interface AchievementBadgeProps {
  title: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  unlockedDate?: string;
}

export function AchievementBadge({
  title,
  description,
  icon,
  isUnlocked,
  unlockedDate,
}: AchievementBadgeProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        isUnlocked
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/30 opacity-60"
      }`}
    >
      <div
        className={`h-12 w-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
          isUnlocked ? "bg-primary/20" : "bg-muted"
        }`}
      >
        {isUnlocked ? icon : <Lock className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-foreground text-sm">{title}</h4>
          {isUnlocked && (
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
        {isUnlocked && unlockedDate && (
          <p className="text-xs text-primary mt-1">Unlocked {unlockedDate}</p>
        )}
      </div>
    </div>
  );
}
