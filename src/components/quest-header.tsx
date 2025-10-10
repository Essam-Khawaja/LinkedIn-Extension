"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { Link } from "react-router-dom";

interface QuestHeaderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function QuestHeader({ title, description, icon }: QuestHeaderProps) {
  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border bg-card/50">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Link to={"/"}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Go back</span>
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            {icon}
          </div>
          <div className="flex flex-col">
            <h1 className="font-semibold text-lg text-foreground leading-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground leading-tight">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
