"use client";

import { api } from "../../../convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { differenceInDays, parseISO } from "date-fns";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  BookOpen,
  Brain,
  Clock,
  Command,
  Layers,
  ListTodo,
  PlaySquare,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/brain-dump", label: "Brain Dump", icon: Brain, description: "Capture thoughts" },
  { href: "/daily-todos", label: "Daily Todos", icon: ListTodo, description: "Today's list" },
  { href: "/watch-list", label: "Watch List", icon: PlaySquare, description: "Things to watch" },
  { href: "/tracker", label: "Tracker", icon: Clock, description: "Deadlines" },
  { href: "/goals", label: "Goals", icon: Target, description: "Things to do" },
  { href: "/vault", label: "The Vault", icon: Layers, description: "Links & resources" },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen, description: "Flashcards" },
  { href: "/api-usage", label: "API Usage", icon: BarChart3, description: "Monitor costs" },
] as const;

interface SidebarProps {
  onCmdK: () => void;
}

export function Sidebar({ onCmdK }: SidebarProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const skip = !isAuthenticated;
  const dueCount = useQuery(api.knowledgeCards.getDueCount, skip ? "skip" : {}) ?? 0;
  const deadlines = useQuery(api.deadlines.list, skip ? "skip" : {}) ?? [];
  const overdueGoals = useQuery(api.goals.getOverdue, skip ? "skip" : {}) ?? [];

  const urgentCount = deadlines.filter((d) => {
    try { const dt = parseISO(d.deadline); if (isNaN(dt.getTime())) return false; return differenceInDays(dt, new Date()) <= 7; } catch { return false; }
  }).length;

  return (
    <aside className="hidden lg:flex flex-col h-full w-56 bg-[hsl(0_0%_5%)] border-r border-[hsl(0_0%_22%)] shrink-0 transition-all duration-200">
      <div className="flex items-center gap-3 px-3 lg:px-4 h-14 border-b border-[hsl(0_0%_22%)]">
        <div className="w-7 h-7 rounded-lg bg-[hsl(263_90%_65%)] flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="hidden lg:flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">Mergen</span>
          <span className="text-[11px] text-[hsl(0_0%_52%)]">the Second Brain</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge =
            item.href === "/knowledge-base" && dueCount > 0
              ? dueCount
              : item.href === "/tracker" && urgentCount > 0
              ? urgentCount
              : item.href === "/goals" && overdueGoals.length > 0
              ? overdueGoals.length
              : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-2 lg:px-3 py-2 rounded-md text-sm transition-all duration-150 relative ${
                isActive
                  ? "bg-[hsl(263_90%_65%/0.15)] text-[hsl(263_90%_75%)]"
                  : "text-[hsl(0_0%_72%)] hover:text-[hsl(0_0%_90%)] hover:bg-[hsl(0_0%_13%)]"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[hsl(263_90%_70%)]" : ""}`} />
              <span className="hidden lg:block truncate">{item.label}</span>
              {badge !== null && (
                <span className="hidden lg:flex absolute right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(263_90%_60%)] text-white text-[10px] font-medium items-center justify-center">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {badge !== null && (
                <span className="lg:hidden absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[hsl(263_90%_60%)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-[hsl(0_0%_22%)] space-y-0.5">
        <button
          onClick={onCmdK}
          className="w-full flex items-center gap-3 px-2 lg:px-3 py-2 rounded-md text-sm text-[hsl(0_0%_68%)] hover:text-[hsl(0_0%_80%)] hover:bg-[hsl(0_0%_13%)] transition-colors"
        >
          <Command className="w-4 h-4 shrink-0" />
          <span className="hidden lg:flex items-center gap-2 flex-1 justify-between">
            <span>Search</span>
            <kbd className="text-[10px] bg-[hsl(0_0%_12%)] border border-[hsl(0_0%_28%)] rounded px-1 py-0.5">⌘K</kbd>
          </span>
        </button>
        <div className="px-2 lg:px-3 py-2">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-7 h-7",
                userButtonPopoverCard: "bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,16%)]",
                userButtonPopoverActionButton: "hover:bg-[hsl(0,0%,12%)] text-[hsl(0,0%,80%)]",
                userButtonPopoverActionButtonText: "text-[hsl(0,0%,80%)]",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
        </div>
      </div>
    </aside>
  );
}
