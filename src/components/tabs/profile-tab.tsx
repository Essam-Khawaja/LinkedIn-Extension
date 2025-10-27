"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Save, X, Loader2, CheckCircle } from "lucide-react";

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentCompany: string;
  yearsExperience: number;
  linkedin: string;
  portfolio: string;
  skills: string[];
  needsSponsorship: boolean;
  willingToRelocate: boolean;
}

interface ProfileTabProps {
  onProfileComplete?: () => void;
}

export function ProfileTab({ onProfileComplete }: ProfileTabProps) {
  // Form state
  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    currentTitle: "",
    currentCompany: "",
    yearsExperience: 0,
    linkedin: "",
    portfolio: "",
    skills: [],
    needsSponsorship: false,
    willingToRelocate: false,
  });

  // Skills input state
  const [skillInput, setSkillInput] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setIsLoading(true);
      const result = await chrome.storage.local.get("profile");

      if (result.profile) {
        setProfile(result.profile);
        console.log("📥 Profile loaded:", result.profile);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate profile completion percentage
  //   function calculateCompletion(): number {
  //     const fields = [
  //       profile.firstName,
  //       profile.lastName,
  //       profile.email,
  //       profile.phone,
  //       profile.currentTitle,
  //       profile.currentCompany,
  //       profile.yearsExperience > 0,
  //       profile.skills.length > 0,
  //     ];

  //     const filledFields = fields.filter(Boolean).length;
  //     return Math.round((filledFields / fields.length) * 100);
  //   }

  // Update profile field
  function updateField(field: keyof UserProfile, value: any) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  // Skills management
  function addSkill() {
    if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) {
      setProfile((prev) => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()],
      }));
      setSkillInput("");
    }
  }

  function removeSkill(index: number) {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  }

  function handleSkillInputKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  }

  // Save profile
  async function handleSave() {
    try {
      setIsSaving(true);
      setSaveSuccess(false);

      // Validate required fields
      if (!profile.firstName || !profile.lastName || !profile.email) {
        alert(
          "Please fill in all required fields (First Name, Last Name, Email)"
        );
        return;
      }

      // Save to chrome.storage
      await chrome.storage.local.set({ profile });

      console.log("💾 Profile saved:", profile);

      // Show success state
      setSaveSuccess(true);

      // Call callback if provided
      if (onProfileComplete) {
        onProfileComplete();
      }

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  //   const completion = calculateCompletion();
  const completion = 85.0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span>⚙️</span>
          Your Profile
        </h2>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Profile completion</p>
          <p className="text-sm font-medium text-foreground">{completion}%</p>
        </div>
      </div>

      <Progress value={completion} className="h-2" />

      {/* Basic Info */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Basic Info</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-xs text-foreground">
              First Name *
            </Label>
            <Input
              id="firstName"
              placeholder="John"
              className="h-9"
              value={profile.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-xs text-foreground">
              Last Name *
            </Label>
            <Input
              id="lastName"
              placeholder="Doe"
              className="h-9"
              value={profile.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs text-foreground">
            Email *
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            className="h-9"
            value={profile.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs text-foreground">
            Phone
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            className="h-9"
            value={profile.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </div>
      </Card>

      {/* Professional */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">
          Professional
        </h3>

        <div className="space-y-2">
          <Label htmlFor="title" className="text-xs text-foreground">
            Current Title
          </Label>
          <Input
            id="title"
            placeholder="Senior Frontend Engineer"
            className="h-9"
            value={profile.currentTitle}
            onChange={(e) => updateField("currentTitle", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company" className="text-xs text-foreground">
            Company
          </Label>
          <Input
            id="company"
            placeholder="Acme Inc."
            className="h-9"
            value={profile.currentCompany}
            onChange={(e) => updateField("currentCompany", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience" className="text-xs text-foreground">
            Years of Experience
          </Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-transparent"
              onClick={() =>
                updateField(
                  "yearsExperience",
                  Math.max(0, profile.yearsExperience - 1)
                )
              }
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id="experience"
              type="number"
              value={profile.yearsExperience}
              onChange={(e) =>
                updateField(
                  "yearsExperience",
                  Number.parseInt(e.target.value) || 0
                )
              }
              className="h-9 text-center"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-transparent"
              onClick={() =>
                updateField("yearsExperience", profile.yearsExperience + 1)
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Skills */}
      <Card className="p-4 bg-card border-border space-y-4">
        <div>
          <h3 className="font-medium text-card-foreground text-sm">Skills</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add your skills to match with job requirements
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="skills" className="text-xs text-foreground">
            Add Skill
          </Label>
          <div className="flex gap-2">
            <Input
              id="skills"
              placeholder="e.g., React, Python, AWS..."
              className="h-9"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={handleSkillInputKeyPress}
            />
            <Button
              variant="outline"
              className="h-9"
              onClick={addSkill}
              disabled={!skillInput.trim()}
            >
              + Add
            </Button>
          </div>
        </div>

        {profile?.skills?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                {skill}
                <button
                  onClick={() => removeSkill(index)}
                  className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {profile?.skills?.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No skills added yet. Add skills to improve job matching!
          </p>
        )}
      </Card>

      {/* Links */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Links</h3>

        <div className="space-y-2">
          <Label htmlFor="linkedin" className="text-xs text-foreground">
            LinkedIn URL
          </Label>
          <Input
            id="linkedin"
            placeholder="linkedin.com/in/johndoe"
            className="h-9"
            value={profile.linkedin}
            onChange={(e) => updateField("linkedin", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="portfolio" className="text-xs text-foreground">
            Portfolio/Website (optional)
          </Label>
          <Input
            id="portfolio"
            placeholder="johndoe.com"
            className="h-9"
            value={profile.portfolio}
            onChange={(e) => updateField("portfolio", e.target.value)}
          />
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-4 bg-card border-border space-y-3">
        <h3 className="font-medium text-card-foreground text-sm">
          Preferences
        </h3>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="visa"
            checked={profile.needsSponsorship}
            onCheckedChange={(checked) =>
              updateField("needsSponsorship", checked as boolean)
            }
          />
          <Label
            htmlFor="visa"
            className="text-sm font-normal cursor-pointer text-foreground"
          >
            Need visa sponsorship
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="relocate"
            checked={profile.willingToRelocate}
            onCheckedChange={(checked) =>
              updateField("willingToRelocate", checked as boolean)
            }
          />
          <Label
            htmlFor="relocate"
            className="text-sm font-normal cursor-pointer text-foreground"
          >
            Willing to relocate
          </Label>
        </div>
      </Card>

      <Button
        className="w-full h-11 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
        onClick={handleSave}
        disabled={
          isSaving || !profile.firstName || !profile.lastName || !profile.email
        }
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : saveSuccess ? (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Profile Saved!
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Profile
          </>
        )}
      </Button>

      {saveSuccess && (
        <div className="text-center text-sm text-green-600 dark:text-green-400">
          ✅ Profile saved successfully! You can now use all features.
        </div>
      )}
    </div>
  );
}
