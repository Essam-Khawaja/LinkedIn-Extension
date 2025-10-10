import { ExtensionHeader } from "@/components/extension-header";
import { StatCard } from "@/components/stat-card";
import { AchievementBadge } from "@/components/achievement-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavigationBar from "@/components/navigation-bar";
import {
  Trophy,
  Target,
  Zap,
  TrendingUp,
  Award,
  Users,
  FileText,
  Briefcase,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function ProfilePage() {
  const stats = [
    {
      label: "Total XP",
      value: "1,240",
      icon: <Zap className="h-4 w-4 text-primary" />,
      trend: { value: "120", isPositive: true },
    },
    {
      label: "Quests Completed",
      value: "8",
      icon: <Target className="h-4 w-4 text-secondary" />,
      trend: { value: "2", isPositive: true },
    },
    {
      label: "Current Streak",
      value: "7 days",
      icon: <TrendingUp className="h-4 w-4 text-success" />,
      trend: { value: "3", isPositive: true },
    },
    {
      label: "Achievements",
      value: "12",
      icon: <Trophy className="h-4 w-4 text-accent" />,
      trend: { value: "1", isPositive: true },
    },
  ];

  const achievements = [
    {
      title: "First Steps",
      description: "Complete your first quest",
      icon: "🎯",
      isUnlocked: true,
      unlockedDate: "2 days ago",
    },
    {
      title: "Content Creator",
      description: "Publish 10 posts on LinkedIn",
      icon: "✍️",
      isUnlocked: true,
      unlockedDate: "1 week ago",
    },
    {
      title: "Network Builder",
      description: "Connect with 50 professionals",
      icon: "🤝",
      isUnlocked: true,
      unlockedDate: "3 days ago",
    },
    {
      title: "Job Hunter",
      description: "Apply to 5 positions",
      icon: "💼",
      isUnlocked: false,
    },
    {
      title: "Engagement Master",
      description: "Get 100 reactions on your posts",
      icon: "⭐",
      isUnlocked: false,
    },
    {
      title: "Consistency King",
      description: "Maintain a 30-day streak",
      icon: "🔥",
      isUnlocked: false,
    },
  ];

  const activityData = [
    {
      label: "Posts",
      count: 15,
      icon: <FileText className="h-4 w-4 text-primary" />,
    },
    {
      label: "Connections",
      count: 127,
      icon: <Users className="h-4 w-4 text-secondary" />,
    },
    {
      label: "Applications",
      count: 3,
      icon: <Briefcase className="h-4 w-4 text-accent" />,
    },
  ];

  return (
    <div className="min-h-screen w-full max-w-md mx-auto bg-background pb-20">
      <ExtensionHeader
        userName="Essam"
        userTitle="Lvl 5 - Title"
        currentXP={1240}
        maxXP={1500}
      />

      <div className="flex flex-col gap-6 p-4">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Level</p>
                <p className="text-3xl font-bold text-foreground">Level 8</p>
                <p className="text-xs text-muted-foreground">
                  260 XP to Level 9
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Rank</p>
              <p className="text-2xl font-bold text-primary">#142</p>
              <p className="text-xs text-muted-foreground">Top 15%</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {activityData.map((activity, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    {activity.icon}
                  </div>
                  <span className="text-sm text-foreground">
                    {activity.label}
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {activity.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Achievements
              </CardTitle>
              <span className="text-sm text-muted-foreground">3/6</span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {achievements.map((achievement, index) => (
              <AchievementBadge key={index} {...achievement} />
            ))}
          </CardContent>
        </Card>

        <Link to="/">
          <Button
            size="lg"
            className="w-full h-12 gradient-primary hover:opacity-90 transition-opacity"
          >
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* <NavigationBar /> */}
    </div>
  );
}
