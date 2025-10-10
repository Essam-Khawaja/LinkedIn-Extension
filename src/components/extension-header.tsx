"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface ExtensionHeaderProps {
  userName?: string;
  userTitle?: string;
  userImage?: string;
  currentXP?: number;
  maxXP?: number;
}

export function ExtensionHeader({
  userName = "Essam",
  userTitle = "WS - Title",
  userImage,
  currentXP = 1240,
  maxXP = 1500,
}: ExtensionHeaderProps) {
  const xpPercentage = (currentXP / maxXP) * 100;

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border bg-card/50">
      {/* User Info Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            <AvatarImage src={userImage || "/placeholder.svg"} alt={userName} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {userName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h2 className="font-semibold text-foreground leading-tight">
              {userName}
            </h2>
            <p className="text-sm text-muted-foreground leading-tight">
              {userTitle}
            </p>
          </div>
        </div>
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        </Link>
      </div>

      {/* XP Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-foreground">
              {currentXP} / {maxXP} XP
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {Math.round(xpPercentage)}%
          </span>
        </div>
        <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 gradient-primary rounded-full transition-all duration-500 glow-primary"
            style={{ width: `${xpPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
