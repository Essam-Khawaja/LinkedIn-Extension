"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  User,
  Mail,
  Sparkles,
  Target,
  Settings,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

export function MainPopup() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const [onUserPage, setOnUserPage] = useState<boolean | null>(null);
  const [onJobsPage, setOnJobsPage] = useState<boolean | null>(null);

  const features = [
    {
      id: "summarizer",
      title: "Job Post Summarizer",
      description: "Extract key requirements and skills",
      icon: FileText,
      status: "ready",
      action: "Analyze Job Post",
      link: "/job-summarizer",
    },
    {
      id: "optimizer",
      title: "Profile Optimizer",
      description: "Enhance your LinkedIn profile",
      icon: User,
      status: "ready",
      action: "Optimize Profile",
      link: "",
    },
    {
      id: "cover-letter",
      title: "Cover Letter Generator",
      description: "Generate personalized cover letters",
      icon: Mail,
      status: "ready",
      action: "Generate Letter",
      link: "",
    },
  ];

  const quickActions = [
    { label: "Daily Goals", icon: Target, count: "3/5" },
    { label: "Applications", icon: Sparkles, count: "12" },
  ];

  return (
    <div className="extension-popup bg-background text-foreground">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">LinkedIn AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Ready to help</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <Link to={"./job-summarizer"}>
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <Separator />

        {/* Later with auth */}
        {/* <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <Card key={action.label} className="feature-card cursor-pointer">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <action.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {action.count}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div> */}

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            AI Tools
          </h2>
          {features.map((feature) => (
            <Card
              key={feature.id}
              className="feature-card cursor-pointer"
              onClick={() => setActiveFeature(feature.id)}
            >
              <Link to={feature.link}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                        <feature.icon className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full status-indicator" />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        <Button className="w-full" size="sm">
          <Sparkles className="w-4 h-4 mr-2" />
          Start AI Analysis
        </Button>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Detected: LinkedIn Job Post
          </p>
        </div>
      </div>
    </div>
  );
}
