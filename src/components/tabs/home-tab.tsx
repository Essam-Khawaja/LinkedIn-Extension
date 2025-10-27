"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  PenLine,
  Bot,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type {
  HomeState,
  ProfileStatus,
} from "@/entrypoints/main-popup/NewPopup";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import UserProfile from "@/lib/types/user";

interface HomeTabProps {
  state: HomeState;
  profileStatus: ProfileStatus;
  onStateChange: (state: HomeState) => void;
  onTabChange: (tab: string) => void;
  profile: UserProfile;
}

export function HomeTab({
  state,
  profileStatus,
  onStateChange,
  onTabChange,
  profile,
}: HomeTabProps) {
  function handleApplyClick() {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) return;

        try {
          // First, try to send a message to see if content script is already loaded
          await chrome.tabs.sendMessage(tab.id, { action: "ping" });
          // If successful, send the actual message
          chrome.tabs.sendMessage(tab.id, { action: "start-auto-fill" });
        } catch (error) {
          // Content script not loaded, inject it first
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content-scripts/content.js"], // Adjust path based on your build output
            });

            // Give it a moment to initialize, then send message
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id!, { action: "start-auto-fill" });
            }, 100);
          } catch (injectionError) {
            console.error("Failed to inject content script:", injectionError);
          }
        }
      });
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
            {profile ? profile.currentTitle : <></>}
          </h3>
          <p className="text-sm text-muted-foreground">
            {profile ? profile.currentCompany : <></>}
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

        {/* <Button
          variant="outline"
          className="w-full h-12 justify-start text-left hover:bg-secondary bg-transparent text-foreground"
        >
          <PenLine className="mr-3 h-5 w-5 text-accent flex-shrink-0" />
          <span className="flex-1">Generate Cover Letter</span>
        </Button> */}

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
          5 applications this week
        </span>
      </div>

      <Card className="p-3 bg-muted/50 border-border">
        <h4 className="text-xs font-medium text-foreground mb-2">
          Recent Applications
        </h4>
        <div className="space-y-2">
          {[
            { title: "Product Designer", company: "Stripe", status: "pending" },
            { title: "UX Engineer", company: "Linear", status: "viewed" },
          ].map((app, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {app.title}
                </p>
                <p className="text-muted-foreground">{app.company}</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {app.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
