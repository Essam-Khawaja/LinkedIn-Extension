"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Minus,
  Plus,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

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

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  currentCompany?: string;
  linkedin?: string;
  skills?: string;
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

  // Validation state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
        console.log("Profile loaded");
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Validation functions
  function validateEmail(email: string): string | undefined {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return undefined;
  }

  function validatePhone(phone: string): string | undefined {
    if (!phone) return "Phone number is required";
    // Allow formats: +1 (555) 123-4567, 555-123-4567, 5551234567, etc.
    const phoneRegex =
      /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return "Please enter a valid phone number";
    }
    return undefined;
  }

  function validateLinkedIn(url: string): string | undefined {
    if (!url) return undefined; // LinkedIn is optional
    if (!url.includes("linkedin.com")) {
      return "Please enter a valid LinkedIn URL";
    }
    return undefined;
  }

  function validateRequired(
    value: string,
    fieldName: string
  ): string | undefined {
    if (!value || value.trim() === "") {
      return `${fieldName} is required`;
    }
    return undefined;
  }

  // Validate all fields
  function validateAllFields(): ValidationErrors {
    const newErrors: ValidationErrors = {};

    newErrors.firstName = validateRequired(profile.firstName, "First name");
    newErrors.lastName = validateRequired(profile.lastName, "Last name");
    newErrors.email = validateEmail(profile.email);
    newErrors.phone = validatePhone(profile.phone);
    newErrors.currentTitle = validateRequired(
      profile.currentTitle,
      "Current title"
    );
    newErrors.currentCompany = validateRequired(
      profile.currentCompany,
      "Company"
    );
    newErrors.linkedin = validateLinkedIn(profile.linkedin);

    if (profile.skills.length === 0) {
      newErrors.skills = "Please add at least one skill";
    }

    // Remove undefined errors
    Object.keys(newErrors).forEach((key) => {
      if (!newErrors[key as keyof ValidationErrors]) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    return newErrors;
  }

  // Check if form is valid
  function isFormValid(): boolean {
    const validationErrors = validateAllFields();
    return Object.keys(validationErrors).length === 0;
  }

  // Calculate profile completion percentage
  function calculateCompletion(): number {
    const fields = [
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.phone,
      profile.currentTitle,
      profile.currentCompany,
      profile.yearsExperience > 0,
      profile.skills.length > 0,
    ];

    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  }

  // Update profile field with validation
  function updateField(field: keyof UserProfile, value: any) {
    setProfile((prev) => ({ ...prev, [field]: value }));

    // Mark field as touched
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate on change
    const newErrors = { ...errors };

    switch (field) {
      case "firstName":
        newErrors.firstName = validateRequired(value, "First name");
        break;
      case "lastName":
        newErrors.lastName = validateRequired(value, "Last name");
        break;
      case "email":
        newErrors.email = validateEmail(value);
        break;
      case "phone":
        newErrors.phone = validatePhone(value);
        break;
      case "currentTitle":
        newErrors.currentTitle = validateRequired(value, "Current title");
        break;
      case "currentCompany":
        newErrors.currentCompany = validateRequired(value, "Company");
        break;
      case "linkedin":
        newErrors.linkedin = validateLinkedIn(value);
        break;
    }

    // Remove error if validation passed
    Object.keys(newErrors).forEach((key) => {
      if (!newErrors[key as keyof ValidationErrors]) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    setErrors(newErrors);
  }

  // Handle field blur
  function handleBlur(field: keyof UserProfile) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  // Skills management
  function addSkill() {
    if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) {
      const newSkills = [...profile.skills, skillInput.trim()];
      setProfile((prev) => ({
        ...prev,
        skills: newSkills,
      }));
      setSkillInput("");

      // Clear skills error if we now have skills
      if (newSkills.length > 0) {
        const newErrors = { ...errors };
        delete newErrors.skills;
        setErrors(newErrors);
      }
    }
  }

  function removeSkill(index: number) {
    const newSkills = profile.skills.filter((_, i) => i !== index);
    setProfile((prev) => ({
      ...prev,
      skills: newSkills,
    }));

    // Add error if no skills left
    if (newSkills.length === 0) {
      setErrors((prev) => ({
        ...prev,
        skills: "Please add at least one skill",
      }));
    }
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
      // Mark all fields as touched
      setTouched({
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        currentTitle: true,
        currentCompany: true,
        linkedin: true,
      });

      // Validate all fields
      const validationErrors = validateAllFields();
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        // Scroll to first error
        const firstErrorField = Object.keys(validationErrors)[0];
        const element = document.getElementById(firstErrorField);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      setIsSaving(true);
      setSaveSuccess(false);

      // Save to chrome.storage
      await chrome.storage.local.set({ profile });

      console.log("Profile saved successfully");

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

  const completion = calculateCompletion();
  const formIsValid = isFormValid();

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
              className={`h-9 ${
                errors.firstName && touched.firstName ? "border-red-500" : ""
              }`}
              value={profile.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              onBlur={() => handleBlur("firstName")}
            />
            {errors.firstName && touched.firstName && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.firstName}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-xs text-foreground">
              Last Name *
            </Label>
            <Input
              id="lastName"
              placeholder="Doe"
              className={`h-9 ${
                errors.lastName && touched.lastName ? "border-red-500" : ""
              }`}
              value={profile.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              onBlur={() => handleBlur("lastName")}
            />
            {errors.lastName && touched.lastName && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.lastName}
              </p>
            )}
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
            className={`h-9 ${
              errors.email && touched.email ? "border-red-500" : ""
            }`}
            value={profile.email}
            onChange={(e) => updateField("email", e.target.value)}
            onBlur={() => handleBlur("email")}
          />
          {errors.email && touched.email && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs text-foreground">
            Phone *
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            className={`h-9 ${
              errors.phone && touched.phone ? "border-red-500" : ""
            }`}
            value={profile.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            onBlur={() => handleBlur("phone")}
          />
          {errors.phone && touched.phone && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.phone}
            </p>
          )}
        </div>
      </Card>

      {/* Professional */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">
          Professional
        </h3>

        <div className="space-y-2">
          <Label htmlFor="currentTitle" className="text-xs text-foreground">
            Current Title *
          </Label>
          <Input
            id="currentTitle"
            placeholder="Senior Frontend Engineer"
            className={`h-9 ${
              errors.currentTitle && touched.currentTitle
                ? "border-red-500"
                : ""
            }`}
            value={profile.currentTitle}
            onChange={(e) => updateField("currentTitle", e.target.value)}
            onBlur={() => handleBlur("currentTitle")}
          />
          {errors.currentTitle && touched.currentTitle && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.currentTitle}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentCompany" className="text-xs text-foreground">
            Company *
          </Label>
          <Input
            id="currentCompany"
            placeholder="Acme Inc."
            className={`h-9 ${
              errors.currentCompany && touched.currentCompany
                ? "border-red-500"
                : ""
            }`}
            value={profile.currentCompany}
            onChange={(e) => updateField("currentCompany", e.target.value)}
            onBlur={() => handleBlur("currentCompany")}
          />
          {errors.currentCompany && touched.currentCompany && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.currentCompany}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="experience" className="text-xs text-foreground">
            Years of Experience *
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
          <h3 className="font-medium text-card-foreground text-sm">Skills *</h3>
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
          <p
            className={`text-xs flex items-center gap-1 ${
              errors.skills ? "text-red-500" : "text-muted-foreground italic"
            }`}
          >
            {errors.skills && <AlertCircle className="h-3 w-3" />}
            {errors.skills ||
              "No skills added yet. Add skills to improve job matching!"}
          </p>
        )}
      </Card>

      {/* Links */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Links</h3>

        <div className="space-y-2">
          <Label htmlFor="linkedin" className="text-xs text-foreground">
            LinkedIn URL *
          </Label>
          <Input
            id="linkedin"
            placeholder="linkedin.com/in/johndoe"
            className={`h-9 ${
              errors.linkedin && touched.linkedin ? "border-red-500" : ""
            }`}
            value={profile.linkedin}
            onChange={(e) => updateField("linkedin", e.target.value)}
            onBlur={() => handleBlur("linkedin")}
          />
          {errors.linkedin && touched.linkedin && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.linkedin}
            </p>
          )}
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
        className="w-full h-11 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground disabled:opacity-50"
        onClick={handleSave}
        disabled={isSaving || !formIsValid}
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
            Save Profile {!formIsValid && "(Complete all fields)"}
          </>
        )}
      </Button>

      {saveSuccess && (
        <div className="text-center text-sm text-green-600 dark:text-green-400">
          Profile saved successfully! You can now use all features.
        </div>
      )}

      {!formIsValid && Object.keys(errors).length > 0 && (
        <div className="text-center text-sm text-red-500 dark:text-red-400">
          Please complete all required fields correctly
        </div>
      )}
    </div>
  );
}
