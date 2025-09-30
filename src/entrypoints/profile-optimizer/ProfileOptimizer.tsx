"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Edit3,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Copy,
  Wand2,
  ArrowRight,
} from "lucide-react";

export function ProfileOptimizer() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const profileSections = [
    {
      id: "headline",
      title: "Professional Headline",
      status: "needs-improvement",
      score: 72,
      current: "Software Engineer at TechCorp",
      suggestion:
        "Senior Frontend Engineer | React & TypeScript Expert | Building Scalable Web Applications",
    },
    {
      id: "summary",
      title: "About Section",
      status: "good",
      score: 85,
      current: "Passionate developer with 5 years of experience...",
      suggestion:
        "Results-driven Senior Frontend Engineer with 5+ years of expertise in React, TypeScript, and modern web technologies...",
    },
    {
      id: "experience",
      title: "Work Experience",
      status: "excellent",
      score: 92,
      current: "Current role description looks great!",
      suggestion: "Minor keyword optimizations suggested",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent":
        return "text-green-500";
      case "good":
        return "text-blue-500";
      case "needs-improvement":
        return "text-yellow-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "excellent":
        return CheckCircle;
      case "good":
        return CheckCircle;
      case "needs-improvement":
        return AlertCircle;
      default:
        return AlertCircle;
    }
  };

  const [onUserPage, setOnUserPage] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || "";
      setOnUserPage(url.includes("linkedin.com/in/"));
    });
  }, []);

  if (!onUserPage) {
    return (
      <div className="extension-popup">
        <Card className="w-full max-w-md">
          <CardContent className="p-4">
            <h1 className="text-3xl text-center font-bold p-4">
              Go to User Page to Access Feature
            </h1>
            <Button
              onClick={() =>
                chrome.tabs.create({
                  // Make sure to put in recommended at the end of the url
                  url: "https://www.linkedin.com/in/",
                })
              }
              className="w-full cursor-pointer"
              variant="outline"
            >
              Go to User Page
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 extension-popup">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Profile Optimizer</CardTitle>
                <CardDescription>
                  AI-powered LinkedIn profile enhancement
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm">
              Overall Score: 83%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button className="flex-1">
              <Sparkles className="w-4 h-4 mr-2" />
              Optimize All Sections
            </Button>
            <Button variant="outline">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Sections */}
      <div className="grid gap-4">
        {profileSections.map((section) => {
          const StatusIcon = getStatusIcon(section.status);
          const isActive = activeSection === section.id;

          return (
            <Card key={section.id} className="transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon
                      className={`w-4 h-4 ${getStatusColor(section.status)}`}
                    />
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {section.score}%
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setActiveSection(isActive ? null : section.id)
                      }
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isActive && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Current
                    </label>
                    <Textarea
                      value={section.current}
                      className="min-h-[60px] text-sm"
                      readOnly
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      AI Suggestion
                    </label>
                    <Textarea
                      value={section.suggestion}
                      className="min-h-[80px] text-sm border-primary/20"
                    />
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      <Wand2 className="w-3 h-3 mr-1" />
                      Apply Suggestion
                    </Button>
                    <Button size="sm" variant="outline">
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
