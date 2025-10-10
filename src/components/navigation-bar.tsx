"use client";

import { Link } from "react-router-dom";
import { Home, Target, Sparkles, User } from "lucide-react";

export default function NavigationBar() {
  const pathname = "/";

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/quests/posts", icon: Target, label: "Quests" },
    { href: "/ai-tools", icon: Sparkles, label: "AI Tools" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
