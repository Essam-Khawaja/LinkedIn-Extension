"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Settings } from "lucide-react";
import { HomeTab } from "@/components/tabs/home-tab";
import { ToolsTab } from "@/components/tabs/tools-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import UserProfile from "@/lib/types/user";

export type HomeState = "job-detected" | "not-on-job" | "first-time";
export type ProfileStatus = "complete" | "incomplete";

export function ExtensionPopup() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [homeState, setHomeState] = useState<HomeState>("first-time");
  const [profileStatus, setProfileStatus] =
    useState<ProfileStatus>("incomplete");
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>();

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        const response = await browser.runtime.sendMessage({
          type: "GET_PROFILE",
        });

        console.log("Profile response:", response);

        if (response?.ok && response.profile) {
          // Profile exists and is valid
          const profile: UserProfile = response.profile;

          // Check if profile has required fields
          const hasRequiredFields =
            profile.firstName && profile.lastName && profile.email;

          if (hasRequiredFields) {
            setProfileStatus("complete");
            setHomeState("job-detected"); // Or "not-on-job" based on current page
            setProfile(profile);
          } else {
            setProfileStatus("incomplete");
            setHomeState("first-time");
          }
        } else {
          // No profile exists
          setProfileStatus("incomplete");
          setHomeState("first-time");
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setProfileStatus("incomplete");
        setHomeState("first-time");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Show loading state while checking profile
  if (isLoading) {
    return (
      <div className="dark extension-popup">
        <div className="bg-background h-[400px] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // If first time, force profile tab
  const currentTab = homeState === "first-time" ? "profile" : activeTab;

  return (
    <div className="dark extension-popup">
      <div className="bg-background overflow-hidden no-scrollbar">
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
        <Tabs
          value={currentTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-border bg-card h-12">
            <TabsTrigger
              value="home"
              className="data-[state=active]:bg-muted"
              disabled={profileStatus === "incomplete"}
            >
              Home
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-muted"
            >
              Profile {profileStatus === "incomplete" && "⚠️"}
            </TabsTrigger>
          </TabsList>

          <div className="max-h-[500px] overflow-y-auto">
            <TabsContent value="home" className="m-0 p-4">
              <HomeTab
                state={homeState}
                profileStatus={profileStatus}
                onStateChange={setHomeState}
                onTabChange={setActiveTab}
                profile={profile!}
              />
            </TabsContent>

            <TabsContent value="profile" className="m-0 p-4">
              <ProfileTab
                onProfileComplete={() => {
                  setProfileStatus("complete");
                  setHomeState("job-detected");
                  setActiveTab("home"); // Switch to home tab after saving
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
