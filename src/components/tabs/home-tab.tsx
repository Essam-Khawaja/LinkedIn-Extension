"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Bot, CheckCircle2, ExternalLink } from "lucide-react";
import type {
  HomeState,
  ProfileStatus,
} from "@/entrypoints/main-popup/NewPopup";
import { Link } from "react-router-dom";
import UserProfile from "@/lib/types/user";
import {
  getApplications,
  getApplicationStats,
  updateApplicationStatus,
} from "@/lib/utils/applicationStorage";
import type { Application, ApplicationStats } from "@/lib/types/application";

interface HomeTabProps {
  state: HomeState;
  profileStatus: ProfileStatus;
  onStateChange: (state: HomeState) => void;
  onTabChange: (tab: string) => void;
  profile?: UserProfile;
}

export function HomeTab({
  state,
  profileStatus,
  onStateChange,
  onTabChange,
  profile,
}: HomeTabProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApplications();

    // Poll for updates every 2 seconds when tab is visible
    const interval = setInterval(loadApplications, 2000);
    return () => clearInterval(interval);
  }, []);

  async function loadApplications() {
    try {
      const [apps, appStats] = await Promise.all([
        getApplications(),
        getApplicationStats(),
      ]);
      setApplications(apps);
      setStats(appStats);
    } catch (error) {
      console.error("Failed to load applications:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(
    id: string,
    newStatus: Application["status"]
  ) {
    try {
      await updateApplicationStatus(id, newStatus);
      // Reload applications to update UI
      await loadApplications();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  function handleApplyClick() {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) return;

        try {
          await chrome.tabs.sendMessage(tab.id, { action: "ping" });
          chrome.tabs.sendMessage(tab.id, { action: "start-auto-fill" });
        } catch (error) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content-scripts/content.js"],
            });

            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id!, { action: "start-auto-fill" });
            }, 100);
          } catch (injectionError) {
            console.error("Failed to inject content script:", injectionError);
          }
        }
      });
  }

  function getStatusColor(status: Application["status"]) {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "viewed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "interviewing":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "accepted":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  }

  if (state === "first-time") {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2 py-4">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-xl font-semibold text-foreground">
            Welcome to SwiftApply!
          </h2>
          <p className="text-sm text-muted-foreground">
            Get started by setting up your profile
          </p>
        </div>

        <Button
          className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
          onClick={() => onTabChange("profile")}
        >
          <span className="mr-2">⚙️</span>
          Set Up Profile
        </Button>

        <Card className="p-4 bg-card border-border">
          <h3 className="font-medium mb-3 text-card-foreground">
            What you'll be able to do:
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              Get AI-powered job summaries
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              Generate personalized cover letters
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              Auto-fill applications instantly
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              Track all your job applications
            </li>
          </ul>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Takes less than 2 minutes! ⚡
        </p>
      </div>
    );
  }

  // job-detected state
  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card border-border">
        <div className="space-y-1">
          <h3 className="font-semibold text-card-foreground text-balance">
            {profile ? (
              <>
                {profile.firstName} {profile.lastName}
              </>
            ) : (
              <></>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            {profile?.education ? profile.education : <>No Education</>}
          </p>
        </div>
      </Card>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full h-12 justify-start text-left hover:bg-secondary bg-transparent text-foreground"
        >
          <Link
            to={"/job-summarizer"}
            className="h-full w-full flex justify-start items-center"
          >
            <FileText className="mr-3 h-5 w-5 text-primary flex-shrink-0" />
            <span className="flex-1">Find a Job</span>
          </Link>
        </Button>

        <Button
          onClick={handleApplyClick}
          className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground justify-start"
        >
          <Link
            to={"/auto-apply"}
            className="h-full w-full flex justify-start items-center"
          >
            <Bot className="mr-3 h-5 w-5 flex-shrink-0" />
            <span className="flex-1">Auto-Fill Application</span>
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Badge
          variant="outline"
          className="bg-success/10 text-success border-success/20"
        >
          <CheckCircle2 className="mr-1 h-4 w-4 flex-shrink-0" />
          Ready
        </Badge>
        <span className="text-xs text-muted-foreground">
          {stats
            ? `${stats.thisWeek} application${
                stats.thisWeek !== 1 ? "s" : ""
              } this week`
            : "Loading..."}
        </span>
      </div>

      {/* Recent Applications */}
      <Card className="p-3 bg-muted/50 border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-foreground">
            Recent Applications
          </h4>
          {stats && stats.total > 0 && (
            <span className="text-xs text-muted-foreground">
              {stats.total} total
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Loading applications...
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-2">
              No applications tracked yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              Save jobs from the "Find a Job" tab
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {applications.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between text-xs p-2 rounded hover:bg-background/50 transition-colors"
              >
                <div className="flex-1 min-w-0 mr-2">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-foreground truncate">
                      {app.jobTitle}
                    </p>
                    {app.jobUrl && (
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate">
                    {app.company}
                  </p>
                  <p className="text-muted-foreground/70 text-[10px] mt-0.5">
                    Applied{" "}
                    {new Date(app.appliedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Select
                  value={app.status}
                  onValueChange={(value) =>
                    handleStatusChange(app.id, value as Application["status"])
                  }
                >
                  <SelectTrigger
                    className={`w-[110px] h-7 text-[10px] ${getStatusColor(
                      app.status
                    )}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending" className="text-xs">
                      Pending
                    </SelectItem>
                    <SelectItem value="viewed" className="text-xs">
                      Viewed
                    </SelectItem>
                    <SelectItem value="interviewing" className="text-xs">
                      Interviewing
                    </SelectItem>
                    <SelectItem value="rejected" className="text-xs">
                      Rejected
                    </SelectItem>
                    <SelectItem value="accepted" className="text-xs">
                      Accepted
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Application Stats Summary */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-2 bg-card/50 border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              Pending
            </p>
            <p className="text-lg font-bold text-center text-foreground">
              {stats.byStatus.pending}
            </p>
          </Card>
          <Card className="p-2 bg-card/50 border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              Viewed
            </p>
            <p className="text-lg font-bold text-center text-foreground">
              {stats.byStatus.viewed}
            </p>
          </Card>
          <Card className="p-2 bg-card/50 border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              Interview
            </p>
            <p className="text-lg font-bold text-center text-foreground">
              {stats.byStatus.interviewing}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
