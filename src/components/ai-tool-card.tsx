"use client";

import type React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface AIToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient?: string;
  link: string;
}

export function AIToolCard({
  title,
  description,
  icon,
  gradient = "from-primary/10 to-secondary/10",
  link,
}: AIToolCardProps) {
  return (
    <Card
      className={`border-border bg-gradient-to-br ${gradient} hover:border-primary/50 transition-all cursor-pointer group `}
    >
      <Link to={link}>
        <CardContent className="p-4 flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-card/80 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 leading-tight">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </CardContent>
      </Link>
    </Card>
  );
}
