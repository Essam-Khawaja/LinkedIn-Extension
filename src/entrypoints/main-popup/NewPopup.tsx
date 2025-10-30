import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { HomeTab } from "@/components/tabs/home-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import { isProfileComplete } from "@/lib/utils/profileValidation";
import UserProfile from "@/lib/types/user";

import logo from "@/assets/Logo.png";

export type HomeState = "job-detected" | "not-on-job" | "first-time";
export type ProfileStatus = "complete" | "incomplete";

export function ExtensionPopup() {
  const [activeTab, setActiveTab] = useState("profile"); // Start on profile
  const [homeState, setHomeState] = useState<HomeState>("first-time");
  const [profileStatus, setProfileStatus] =
    useState<ProfileStatus>("incomplete");
  const [profile, setProfile] = useState<UserProfile>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkProfileStatus();
  }, []);

  async function checkProfileStatus() {
    try {
      setIsLoading(true);

      const response = await chrome.runtime.sendMessage({
        type: "GET_PROFILE",
      });

      console.log("Profile check response:", response);

      if (response?.ok && response.profile) {
        // Use validation helper to check completeness
        const isComplete = isProfileComplete(response.profile);

        if (isComplete) {
          setProfileStatus("complete");
          setHomeState("job-detected"); // Or check actual page
          setProfile(response.profile);
          setActiveTab("home"); // Switch to home if complete
        } else {
          setProfileStatus("incomplete");
          setHomeState("first-time");
          setActiveTab("profile"); // Stay on profile
        }
      } else {
        // No profile exists
        setProfileStatus("incomplete");
        setHomeState("first-time");
        setActiveTab("profile");
      }
    } catch (err) {
      console.error("Failed to check profile:", err);
      setProfileStatus("incomplete");
      setHomeState("first-time");
      setActiveTab("profile");
    } finally {
      setIsLoading(false);
    }
  }

  function handleProfileComplete() {
    // Profile was saved and is now complete
    setProfileStatus("complete");
    setHomeState("job-detected");
    setActiveTab("home"); // Auto-switch to home
  }

  if (isLoading) {
    return (
      <div className="dark extension-popup">
        <div className="bg-background h-[400px] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark extension-popup">
      <div className="bg-background overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg from-primary to-accent flex items-center justify-center">
              <span className="text-lg">
                <img className="rounded-full" src={logo}></img>
              </span>
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
            <TabsTrigger
              value="home"
              className="data-[state=active]:bg-muted"
              disabled={profileStatus === "incomplete"}
            >
              Home
              {profileStatus === "incomplete" && (
                <span className="ml-1.5 text-xs">🔒</span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-muted"
            >
              Profile
              {profileStatus === "incomplete" && (
                <span className="ml-1.5 text-xs text-amber-500">⚠️</span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="max-h-[500px] overflow-y-auto">
            <TabsContent value="home" className="m-0 p-4">
              {profileStatus === "complete" ? (
                <HomeTab
                  state={homeState}
                  profileStatus={profileStatus}
                  onStateChange={setHomeState}
                  onTabChange={setActiveTab}
                  profile={profile}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    Complete your profile to access features
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="profile" className="m-0 p-4">
              <ProfileTab onProfileComplete={handleProfileComplete} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
