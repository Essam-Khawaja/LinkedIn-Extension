"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Briefcase,
} from "lucide-react";
import type UserProfile from "@/lib/types/user";
import type { EmploymentEntry } from "@/lib/types/user";

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  linkedin?: string;
  github?: string;
  skills?: string;
  employmentHistory?: string;
}

interface ProfileTabProps {
  onProfileComplete?: () => void;
}

export function ProfileTab({ onProfileComplete }: ProfileTabProps) {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    yearsExperience: 0,
    employmentHistory: [],
    skills: [],
    education: "",
    resumeSummary: "",
    certifications: [],
    salaryExpectation: "",
    linkedin: "",
    portfolio: "",
    github: "",
    needsSponsorship: false,
    willingToRelocate: false,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setIsLoading(true);
      const result = await chrome.storage.local.get("profile");
      if (result.profile) {
        // Ensure employmentHistory exists (for backward compatibility)
        const loadedProfile = {
          ...result.profile,
          employmentHistory: result.profile.employmentHistory || [],
          certifications: result.profile.certifications || [],
        };
        setProfile(loadedProfile);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Validation
  function validateEmail(email: string): string | undefined {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email";
    return undefined;
  }

  function validatePhone(phone: string): string | undefined {
    if (!phone) return "Phone is required";
    const phoneRegex =
      /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return "Please enter a valid phone number";
    }
    return undefined;
  }

  function validateURL(url: string, platform: string): string | undefined {
    if (!url) return `${platform} URL is required`;
    if (!url.includes(platform.toLowerCase())) {
      return `Please enter a valid ${platform} URL`;
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

  function validateAllFields(): ValidationErrors {
    const newErrors: ValidationErrors = {};

    newErrors.firstName = validateRequired(profile.firstName, "First name");
    newErrors.lastName = validateRequired(profile.lastName, "Last name");
    newErrors.email = validateEmail(profile.email);
    newErrors.phone = validatePhone(profile.phone);
    newErrors.address = validateRequired(profile.address, "Address");
    newErrors.city = validateRequired(profile.city, "City");
    newErrors.state = validateRequired(profile.state, "State");
    newErrors.zip = validateRequired(profile.zip, "ZIP code");
    newErrors.linkedin = validateURL(profile.linkedin, "LinkedIn");

    if (profile.github && !profile.github.includes("github.com")) {
      newErrors.github = "Please enter a valid GitHub URL";
    }

    if ((profile.skills || []).length === 0) {
      newErrors.skills = "Please add at least one skill";
    }

    Object.keys(newErrors).forEach((key) => {
      if (!newErrors[key as keyof ValidationErrors]) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    return newErrors;
  }

  function isFormValid(): boolean {
    const validationErrors = validateAllFields();
    return Object.keys(validationErrors).length === 0;
  }

  function calculateCompletion(): number {
    const requiredFields = [
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.phone,
      profile.address,
      profile.city,
      profile.state,
      profile.zip,
      profile.linkedin,
      (profile.skills || []).length > 0,
    ];

    const optionalFields = [
      profile.education,
      profile.resumeSummary,
      profile.github,
      profile.portfolio,
      (profile.certifications || []).length > 0,
      (profile.employmentHistory || []).length > 0,
      profile.salaryExpectation,
    ];

    const requiredFilled = requiredFields.filter(Boolean).length;
    const optionalFilled = optionalFields.filter(Boolean).length;

    const requiredWeight = 0.7;
    const optionalWeight = 0.3;

    const requiredScore =
      (requiredFilled / requiredFields.length) * requiredWeight;
    const optionalScore =
      (optionalFilled / optionalFields.length) * optionalWeight;

    return Math.round((requiredScore + optionalScore) * 100);
  }

  function updateField(field: keyof UserProfile, value: any) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));

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
      case "linkedin":
        newErrors.linkedin = validateURL(value, "LinkedIn");
        break;
      case "github":
        if (value && !value.includes("github.com")) {
          newErrors.github = "Please enter a valid GitHub URL";
        } else {
          delete newErrors.github;
        }
        break;
    }

    Object.keys(newErrors).forEach((key) => {
      if (!newErrors[key as keyof ValidationErrors]) {
        delete newErrors[key as keyof ValidationErrors];
      }
    });

    setErrors(newErrors);
  }

  function handleBlur(field: keyof UserProfile) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function addSkill() {
    if (
      skillInput.trim() &&
      !(profile.skills || []).includes(skillInput.trim())
    ) {
      const newSkills = [...(profile.skills || []), skillInput.trim()];
      setProfile((prev) => ({ ...prev, skills: newSkills }));
      setSkillInput("");
      if (newSkills.length > 0) {
        const newErrors = { ...errors };
        delete newErrors.skills;
        setErrors(newErrors);
      }
    }
  }

  function removeSkill(index: number) {
    const newSkills = (profile.skills || []).filter((_, i) => i !== index);
    setProfile((prev) => ({ ...prev, skills: newSkills }));
    if (newSkills.length === 0) {
      setErrors((prev) => ({
        ...prev,
        skills: "Please add at least one skill",
      }));
    }
  }

  function addCertification() {
    if (certInput.trim()) {
      const newCerts = [...(profile.certifications || []), certInput.trim()];
      setProfile((prev) => ({ ...prev, certifications: newCerts }));
      setCertInput("");
    }
  }

  function removeCertification(index: number) {
    const newCerts = (profile.certifications || []).filter(
      (_, i) => i !== index
    );
    setProfile((prev) => ({ ...prev, certifications: newCerts }));
  }

  // Employment History Management
  function addEmployment() {
    const newEntry: EmploymentEntry = {
      id: Date.now().toString(),
      jobTitle: "",
      company: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    };
    setProfile((prev) => ({
      ...prev,
      employmentHistory: [...(prev.employmentHistory || []), newEntry],
    }));
  }

  function updateEmployment(
    id: string,
    field: keyof EmploymentEntry,
    value: any
  ) {
    setProfile((prev) => ({
      ...prev,
      employmentHistory: (prev.employmentHistory || []).map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
  }

  function removeEmployment(id: string) {
    setProfile((prev) => ({
      ...prev,
      employmentHistory: (prev.employmentHistory || []).filter(
        (entry) => entry.id !== id
      ),
    }));
  }

  function toggleCurrentEmployment(id: string) {
    setProfile((prev) => ({
      ...prev,
      employmentHistory: (prev.employmentHistory || []).map((entry) =>
        entry.id === id
          ? {
              ...entry,
              isCurrent: !entry.isCurrent,
              endDate: !entry.isCurrent ? "" : entry.endDate,
            }
          : entry
      ),
    }));
  }

  async function handleSave() {
    try {
      setTouched({
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        linkedin: true,
      });

      const validationErrors = validateAllFields();
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        const firstErrorField = Object.keys(validationErrors)[0];
        const element = document.getElementById(firstErrorField);
        // element?.scrollIntoView({ behavior: "smooth", block: "center" });
        // return;
      }

      setIsSaving(true);
      setSaveSuccess(false);

      await chrome.storage.local.set({ profile });

      setSaveSuccess(true);

      if (onProfileComplete) {
        onProfileComplete();
      }

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
          <p className="text-xs text-muted-foreground">Completion</p>
          <p className="text-sm font-medium text-foreground">{completion}%</p>
        </div>
      </div>

      <Progress value={completion} className="h-2" />

      {/* Basic Info */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Basic Info</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-xs">
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
            <Label htmlFor="lastName" className="text-xs">
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
          <Label htmlFor="email" className="text-xs">
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
          <Label htmlFor="phone" className="text-xs">
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

      {/* Location */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Location</h3>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-xs">
            Address *
          </Label>
          <Input
            id="address"
            placeholder="123 Main St"
            className="h-9"
            value={profile.address}
            onChange={(e) => updateField("address", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="city" className="text-xs">
              City *
            </Label>
            <Input
              id="city"
              placeholder="San Francisco"
              className="h-9"
              value={profile.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" className="text-xs">
              State *
            </Label>
            <Input
              id="state"
              placeholder="CA"
              className="h-9"
              value={profile.state}
              onChange={(e) => updateField("state", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zip" className="text-xs">
            ZIP Code *
          </Label>
          <Input
            id="zip"
            placeholder="94102"
            className="h-9"
            value={profile.zip}
            onChange={(e) => updateField("zip", e.target.value)}
          />
        </div>
      </Card>

      {/* Professional */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">
          Professional
        </h3>

        <div className="space-y-2">
          <Label htmlFor="yearsExperience" className="text-xs">
            Total Years of Experience *
          </Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
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
              id="yearsExperience"
              type="number"
              value={profile.yearsExperience}
              onChange={(e) =>
                updateField("yearsExperience", parseInt(e.target.value) || 0)
              }
              className="h-9 text-center"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() =>
                updateField("yearsExperience", profile.yearsExperience + 1)
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="education" className="text-xs">
            Education (optional)
          </Label>
          <Input
            id="education"
            placeholder="Bachelor's in Computer Science, MIT"
            className="h-9"
            value={profile.education}
            onChange={(e) => updateField("education", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="salaryExpectation" className="text-xs">
            Salary Expectation (optional)
          </Label>
          <Input
            id="salaryExpectation"
            placeholder="$80,000 - $100,000"
            className="h-9"
            value={profile.salaryExpectation}
            onChange={(e) => updateField("salaryExpectation", e.target.value)}
          />
        </div>
      </Card>

      {/* Employment History */}
      <Card className="p-4 bg-card border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-card-foreground text-sm">
              Employment History (optional)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Add your work experience to improve applications
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addEmployment}
            className="h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Job
          </Button>
        </div>

        {profile.employmentHistory?.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No employment history added yet</p>
            <p className="text-xs mt-1">
              Add work experience to strengthen your applications
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(profile.employmentHistory || []).map((job, index) => (
              <Card key={job.id} className="p-3 bg-background border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Position {index + 1}
                    </span>
                    {job.isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEmployment(job.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Job Title</Label>
                      <Input
                        placeholder="Software Engineer"
                        className="h-8 text-sm"
                        value={job.jobTitle}
                        onChange={(e) =>
                          updateEmployment(job.id, "jobTitle", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Company</Label>
                      <Input
                        placeholder="Acme Inc."
                        className="h-8 text-sm"
                        value={job.company}
                        onChange={(e) =>
                          updateEmployment(job.id, "company", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input
                        type="month"
                        className="h-8 text-sm"
                        value={job.startDate}
                        onChange={(e) =>
                          updateEmployment(job.id, "startDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input
                        type="month"
                        className="h-8 text-sm"
                        value={job.endDate}
                        onChange={(e) =>
                          updateEmployment(job.id, "endDate", e.target.value)
                        }
                        disabled={job.isCurrent}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`current-${job.id}`}
                      checked={job.isCurrent}
                      onCheckedChange={() => toggleCurrentEmployment(job.id)}
                    />
                    <Label
                      htmlFor={`current-${job.id}`}
                      className="text-xs font-normal cursor-pointer"
                    >
                      I currently work here
                    </Label>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Description (optional)</Label>
                    <Textarea
                      placeholder="Brief description of responsibilities and achievements..."
                      className="min-h-[60px] text-sm"
                      value={job.description}
                      onChange={(e) =>
                        updateEmployment(job.id, "description", e.target.value)
                      }
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Skills */}
      <Card className="p-4 bg-card border-border space-y-4">
        <div>
          <h3 className="font-medium text-card-foreground text-sm">Skills *</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add skills to match with job requirements
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., React, Python, AWS..."
              className="h-9"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" && (e.preventDefault(), addSkill())
              }
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
            {(profile.skills || []).map((skill, index) => (
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

        {errors.skills && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.skills}
          </p>
        )}
      </Card>

      {/* Certifications */}
      <Card className="p-4 bg-card border-border space-y-4">
        <div>
          <h3 className="font-medium text-card-foreground text-sm">
            Certifications (optional)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Professional certifications and licenses
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g., AWS Certified Solutions Architect"
            className="h-9"
            value={certInput}
            onChange={(e) => setCertInput(e.target.value)}
            onKeyPress={(e) =>
              e.key === "Enter" && (e.preventDefault(), addCertification())
            }
          />
          <Button
            variant="outline"
            className="h-9"
            onClick={addCertification}
            disabled={!certInput.trim()}
          >
            + Add
          </Button>
        </div>

        {(profile.certifications?.length || 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.certifications?.map((cert, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                {cert}
                <button
                  onClick={() => removeCertification(index)}
                  className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Resume Summary */}
      <Card className="p-4 bg-card border-border space-y-4">
        <div>
          <h3 className="font-medium text-card-foreground text-sm">
            Resume Summary (optional)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Brief overview of your experience and achievements
          </p>
        </div>

        <Textarea
          placeholder="Experienced software engineer with 5+ years building scalable web applications..."
          className="min-h-[100px]"
          value={profile.resumeSummary}
          onChange={(e) => updateField("resumeSummary", e.target.value)}
        />
      </Card>

      {/* Links */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Links</h3>

        <div className="space-y-2">
          <Label htmlFor="linkedin" className="text-xs">
            LinkedIn *
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
          <Label htmlFor="github" className="text-xs">
            GitHub (optional)
          </Label>
          <Input
            id="github"
            placeholder="github.com/johndoe"
            className="h-9"
            value={profile.github}
            onChange={(e) => updateField("github", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="portfolio" className="text-xs">
            Portfolio (optional)
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
          <Label htmlFor="visa" className="text-sm font-normal cursor-pointer">
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
            className="text-sm font-normal cursor-pointer"
          >
            Willing to relocate
          </Label>
        </div>
      </Card>

      <Button
        className="w-full h-11 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground disabled:opacity-50"
        onClick={handleSave}
        disabled={isSaving}
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
            {/* {!formIsValid && "(Complete required fields)"} */}
          </>
        )}
      </Button>

      {saveSuccess && (
        <div>
          {formIsValid
            ? "✅ Profile saved! You can now access all features."
            : "💾 Progress saved! Complete all required fields to access the Home tab."}
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
