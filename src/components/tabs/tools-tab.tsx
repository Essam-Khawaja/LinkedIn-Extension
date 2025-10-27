"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  PenLine,
  Bot,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ProfileStatus } from "@/entrypoints/main-popup/NewPopup";

interface ToolsTabProps {
  profileStatus: ProfileStatus;
}

export function ToolsTab({ profileStatus }: ToolsTabProps) {
  const tools = [
    {
      icon: FileText,
      title: "Job Summarizer",
      description: "Get AI-powered job summaries",
      status: "active" as const,
    },
    {
      icon: PenLine,
      title: "Cover Letter Generator",
      description: "Create personalized letters",
      status: "active" as const,
    },
    {
      icon: Bot,
      title: "Application Auto-Fill",
      description: "Fill forms automatically",
      status:
        profileStatus === "complete"
          ? ("active" as const)
          : ("needs-profile" as const),
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground mb-4">Your Tools</h2>

      {tools.map((tool, index) => {
        const Icon = tool.icon;
        return (
          <Card
            key={index}
            className="p-4 bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-medium text-card-foreground">
                    {tool.title}
                  </h3>
                  {tool.status === "active" ? (
                    <Badge
                      variant="outline"
                      className="bg-success/10 text-success border-success/20 text-xs flex-shrink-0"
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-warning/10 text-warning border-warning/20 text-xs flex-shrink-0"
                    >
                      <AlertCircle className="mr-1 h-4 w-4" />
                      Profile needed
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            </div>
          </Card>
        );
      })}

      <Card className="p-4 bg-muted/30 border-border mt-6">
        <h3 className="text-sm font-medium text-foreground mb-2">
          Daily Progress
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Applications today</span>
            <span className="font-medium text-foreground">3 / 5</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
              style={{ width: "60%" }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
