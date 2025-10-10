"use client";

import { Link } from "react-router-dom";
import { ExtensionHeader } from "@/components/extension-header";
import QuestProgressBar from "@/components/quest-progress-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NavigationBar from "@/components/navigation-bar";
import { FileText, UserPlus, Briefcase, Sparkles } from "lucide-react";

export default function MainPopup() {
  return (
    <div className="min-h-screen w-full max-w-md mx-auto bg-background pb-20 extension-popup">
      {/* Header with User Info and XP */}
      {/* <NavigationBar /> */}
      <ExtensionHeader
        userName="Essam"
        userTitle="Lvl 5 - Title"
        currentXP={1240}
        maxXP={1500}
      />

      {/* Main Content */}
      <div className="flex flex-col gap-6 p-4 ">
        {/* Active Quests Section */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Active Quests
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Link
              to="/quests/posts"
              className="block hover:opacity-80 transition-opacity"
            >
              <QuestProgressBar
                label="Posts"
                current={3}
                max={5}
                variant="primary"
              />
            </Link>
            <Link
              to="/quests/connects"
              className="block hover:opacity-80 transition-opacity"
            >
              <QuestProgressBar
                label="Connects"
                current={2}
                max={5}
                variant="secondary"
              />
            </Link>
            <Link
              to="/quests/applications"
              className="block hover:opacity-80 transition-opacity"
            >
              <QuestProgressBar
                label="Applications"
                current={1}
                max={10}
                variant="accent"
              />
            </Link>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold gradient-primary hover:opacity-90 transition-opacity"
          >
            <FileText className="h-5 w-5 mr-2" />
            Make a post
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 text-base font-semibold border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors bg-transparent"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Connect
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 text-base font-semibold border-2 border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors bg-transparent"
          >
            <Link
              to={"./job-summarizer"}
              className="w-full flex justify-center items-center h-full"
            >
              <Briefcase className="h-5 w-5 mr-2" />
              Apply
            </Link>
          </Button>
        </div>

        {/* AI Tools Teaser */}
        <Link to="/ai-tools">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">AI Tools</p>
                  <p className="text-sm text-muted-foreground">
                    Enhance your presence
                  </p>
                </div>
              </div>
              <div className="text-primary text-sm font-medium">Explore →</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
