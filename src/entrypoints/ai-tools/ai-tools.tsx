"use client";

import { QuestHeader } from "@/components/quest-header";
import { AIToolCard } from "@/components/ai-tool-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  FileText,
  MessageSquare,
  Lightbulb,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

export default function AIToolsPage() {
  const tools = [
    {
      title: "Profile Optimizer",
      description:
        "Optimize your profile with our AI agent built to get you hired!",
      icon: <FileText className="h-6 w-6 text-primary" />,
      gradient: "from-primary/10 to-primary/5",
      link: "/profile-optimizer",
    },
    // {
    //   title: "Comment Assistant",
    //   description: "Generate thoughtful comments to boost engagement",
    //   icon: <MessageSquare className="h-6 w-6 text-secondary" />,
    //   gradient: "from-secondary/10 to-secondary/5",
    // },
    // {
    //   title: "Headline Optimizer",
    //   description: "Craft compelling headlines that stand out",
    //   icon: <Lightbulb className="h-6 w-6 text-success" />,
    //   gradient: "from-success/10 to-success/5",
    // },
    // {
    //   title: "Profile Summary Writer",
    //   description: "Write a professional summary that showcases your value",
    //   icon: <Target className="h-6 w-6 text-primary" />,
    //   gradient: "from-primary/10 to-primary/5",
    // },
    // {
    //   title: "Content Ideas",
    //   description:
    //     "Get personalized content suggestions based on your industry",
    //   icon: <TrendingUp className="h-6 w-6 text-secondary" />,
    //   gradient: "from-secondary/10 to-secondary/5",
    // },
    // {
    //   title: "Connection Message",
    //   description: "Personalize connection requests with AI-powered messages",
    //   icon: <Zap className="h-6 w-6 text-accent" />,
    //   gradient: "from-accent/10 to-accent/5",
    // },
  ];

  return (
    <div className="extension-popup max-w-md mx-auto bg-background pb-20">
      <QuestHeader
        title="AI Tools"
        description="Enhance your LinkedIn presence"
        icon={<Sparkles className="h-5 w-5 text-primary" />}
      />

      <div className="flex flex-col gap-6 p-4">
        {/* <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  AI-Powered Productivity
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Use these tools to create better content, engage more
                  effectively, and grow your professional presence faster.
                </p>
              </div>
            </div>
          </CardContent>
        </Card> */}

        <div className="flex flex-col gap-3">
          {tools.map((tool, index) => (
            <AIToolCard key={index} {...tool} />
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-3">This Week</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-primary">12</span>
                <span className="text-sm text-muted-foreground">
                  Posts Generated
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-secondary">28</span>
                <span className="text-sm text-muted-foreground">
                  Comments Written
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-success">+340</span>
                <span className="text-sm text-muted-foreground">XP Earned</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-accent">5</span>
                <span className="text-sm text-muted-foreground">
                  Tools Used
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
