interface QuestProgressBarProps {
  label: string;
  current: number;
  max: number;
  variant?: "primary" | "secondary" | "accent";
}

export default function QuestProgressBar({
  label,
  current,
  max,
  variant = "primary",
}: QuestProgressBarProps) {
  const percentage = (current / max) * 100;
  const isComplete = current >= max;

  const variantStyles = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    accent: "bg-accent",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">
          {current}/{max}
        </span>
      </div>
      <div className="relative h-2.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            variantStyles[variant]
          } ${isComplete ? "glow-success" : ""}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
