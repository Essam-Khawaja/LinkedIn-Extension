"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Minus, Plus, Save } from "lucide-react";

interface ProfileTabProps {
  onProfileComplete: () => void;
}

export function ProfileTab({ onProfileComplete }: ProfileTabProps) {
  const [yearsExperience, setYearsExperience] = useState(5);
  const [needsVisa, setNeedsVisa] = useState(false);
  const [willingToRelocate, setWillingToRelocate] = useState(false);

  const handleSave = () => {
    onProfileComplete();
    // Show toast notification
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span>⚙️</span>
          Your Profile
        </h2>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Profile completion</p>
          <p className="text-sm font-medium text-foreground">85%</p>
        </div>
      </div>

      <Progress value={85} className="h-2" />

      {/* Basic Info */}
      <Card className="p-4 bg-card border-border space-y-4">
        <h3 className="font-medium text-card-foreground text-sm">Basic Info</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-xs text-foreground">
              First Name
            </Label>
            <Input id="firstName" placeholder="John" className="h-9" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-xs text-foreground">
              Last Name
            </Label>
            <Input id="lastName" placeholder="Doe" className="h-9" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs text-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            className="h-9"
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company" className="text-xs text-foreground">
            Company
          </Label>
          <Input id="company" placeholder="Acme Inc." className="h-9" />
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
                setYearsExperience(Math.max(0, yearsExperience - 1))
              }
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id="experience"
              type="number"
              value={yearsExperience}
              onChange={(e) =>
                setYearsExperience(Number.parseInt(e.target.value) || 0)
              }
              className="h-9 text-center"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 bg-transparent"
              onClick={() => setYearsExperience(yearsExperience + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="portfolio" className="text-xs text-foreground">
            Portfolio/Website (optional)
          </Label>
          <Input id="portfolio" placeholder="johndoe.com" className="h-9" />
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
            checked={needsVisa}
            onCheckedChange={(checked) => setNeedsVisa(checked as boolean)}
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
            checked={willingToRelocate}
            onCheckedChange={(checked) =>
              setWillingToRelocate(checked as boolean)
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
      >
        <Save className="mr-2 h-4 w-4" />
        Save Profile
      </Button>
    </div>
  );
}
