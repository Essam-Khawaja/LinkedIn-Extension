"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Settings } from "lucide-react";
import { HomeTab } from "@/components/tabs/home-tab";
import { ToolsTab } from "@/components/tabs/tools-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";

export type HomeState = "job-detected" | "not-on-job" | "first-time";
export type ProfileStatus = "complete" | "incomplete";

export function ExtensionPopup() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [homeState, setHomeState] = useState<HomeState>("job-detected");
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("complete");

  return (
    <div className="dark extension-popup">
      <div className="bg-background overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <h1 className="font-semibold text-card-foreground">SwiftApply</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-border bg-card h-12">
            <TabsTrigger value="home" className="data-[state=active]:bg-muted">
              Home
            </TabsTrigger>
            {/* <TabsTrigger value="tools" className="data-[state=active]:bg-muted">
              Tools
            </TabsTrigger> */}
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-muted"
            >
              Profile
            </TabsTrigger>
          </TabsList>

          <div className="max-h-[500px] overflow-y-auto">
            <TabsContent value="home" className="m-0 p-4">
              <HomeTab
                state={homeState}
                profileStatus={profileStatus}
                onStateChange={setHomeState}
                onTabChange={setActiveTab}
              />
            </TabsContent>

            {/* <TabsContent value="tools" className="m-0 p-4">
              <ToolsTab profileStatus={profileStatus} />
            </TabsContent> */}

            <TabsContent value="profile" className="m-0 p-4">
              <ProfileTab
                onProfileComplete={() => setProfileStatus("complete")}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
