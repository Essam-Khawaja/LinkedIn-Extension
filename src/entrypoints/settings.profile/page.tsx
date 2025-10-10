"use client";

import { QuestHeader } from "@/components/quest-header";
import { ProfileInput } from "@/components/profile-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Briefcase,
  MapPin,
  Building2,
  LinkIcon,
  FileText,
  Camera,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ProfileSettingsPage() {
  const [name, setName] = useState("Essam");
  const [title, setTitle] = useState("Lvl5 - Title");
  const [email, setEmail] = useState("essam@example.com");
  const [linkedinUrl, setLinkedinUrl] = useState("linkedin.com/in/essam");
  const [bio, setBio] = useState(
    "Passionate professional focused on growth and networking."
  );
  const [location, setLocation] = useState("San Francisco, CA");
  const [industry, setIndustry] = useState("Technology");

  const handleSave = () => {
    console.log("[v0] Saving profile:", {
      name,
      title,
      email,
      linkedinUrl,
      bio,
      location,
      industry,
    });
    // TODO: Implement actual save logic
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto bg-background">
      <QuestHeader
        title="Profile Settings"
        description="Update your personal information"
        icon={<User className="h-5 w-5 text-primary" />}
      />

      <div className="flex flex-col gap-6 p-4">
        {/* Profile Picture Section */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl font-bold text-white">
              E
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-primary/30 text-primary hover:bg-primary/10 bg-transparent"
            >
              <Camera className="h-4 w-4 mr-2" />
              Change Photo
            </Button>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProfileInput
              label="Full Name"
              value={name}
              onChange={setName}
              placeholder="Enter your full name"
              icon={<User className="h-4 w-4 text-primary" />}
            />
            <ProfileInput
              label="Professional Title"
              value={title}
              onChange={setTitle}
              placeholder="e.g., Software Engineer"
              icon={<Briefcase className="h-4 w-4 text-secondary" />}
            />
            <ProfileInput
              label="Email Address"
              value={email}
              onChange={setEmail}
              placeholder="your.email@example.com"
              type="email"
              icon={<Mail className="h-4 w-4 text-accent" />}
            />
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Professional Details
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProfileInput
              label="LinkedIn Profile URL"
              value={linkedinUrl}
              onChange={setLinkedinUrl}
              placeholder="linkedin.com/in/yourprofile"
              type="url"
              icon={<LinkIcon className="h-4 w-4 text-primary" />}
            />
            <ProfileInput
              label="Location"
              value={location}
              onChange={setLocation}
              placeholder="City, State/Country"
              icon={<MapPin className="h-4 w-4 text-secondary" />}
            />
            <ProfileInput
              label="Industry"
              value={industry}
              onChange={setIndustry}
              placeholder="e.g., Technology, Finance"
              icon={<Building2 className="h-4 w-4 text-accent" />}
            />
          </CardContent>
        </Card>

        {/* About Section */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">About</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileInput
              label="Bio"
              value={bio}
              onChange={setBio}
              placeholder="Tell us about yourself and your professional goals..."
              type="textarea"
              icon={<FileText className="h-4 w-4 text-primary" />}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pb-4">
          <Button
            size="lg"
            className="w-full h-12 gradient-primary hover:opacity-90 transition-opacity"
            onClick={handleSave}
          >
            Save Changes
          </Button>
          <Link to="/settings">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 border-border bg-transparent"
            >
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
