"use client";

import { api } from "../../../convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { differenceInDays, parseISO } from "date-fns";
import {
  BarChart3,
  BookOpen,
  Brain,
  Clock,
  Layers,
  ListTodo,
  MoreHorizontal,
  PlaySquare,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PRIMARY_NAV = [
  { href: "/brain-dump", label: "Brain", icon: Brain },
  { href: "/daily-todos", label: "Todos", icon: ListTodo },
  { href: "/watch-list", label: "Watch", icon: PlaySquare },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/tracker", label: "Tracker", icon: Clock },
] as const;

const MORE_NAV = [
  { href: "/knowledge-base", label: "Knowledge", icon: BookOpen },
  { href: "/vault", label: "Vault", icon: Layers },
  { href: "/api-usage", label: "Usage", icon: BarChart3 },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const skip = !isAuthenticated;
  const [moreOpen, setMoreOpen] = useState(false);
  const dueCount = useQuery(api.knowledgeCards.getDueCount, skip ? "skip" : {}) ?? 0;
  const deadlines = useQuery(api.deadlines.list, skip ? "skip" : {}) ?? [];
  const overdueGoals = useQuery(api.goals.getOverdue, skip ? "skip" : {}) ?? [];

  const urgentCount = deadlines.filter((d) => {
    try { const dt = parseISO(d.deadline); if (isNaN(dt.getTime())) return false; return differenceInDays(dt, new Date()) <= 7; } catch { return false; }
  }).length;

  const isInMore = MORE_NAV.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  function NavLink({ item, badge }: { item: (typeof PRIMARY_NAV)[number] | (typeof MORE_NAV)[number]; badge?: number }) {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        onClick={() => setMoreOpen(false)}
        className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
          isActive ? "bg-[hsl(263_90%_65%/0.2)] text-[hsl(263_90%_75%)]" : "text-[hsl(0_0%_72%)] active:bg-[hsl(0_0%_12%)]"
        }`}
      >
        <span className="relative">
          <Icon className="w-5 h-5" />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[hsl(263_90%_60%)] text-white text-[10px] font-medium flex items-center justify-center">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
        <span className="text-[10px] mt-0.5">{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[55] bg-[hsl(0_0%_13%)] border-t border-[hsl(0_0%_22%)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around px-2 py-2">
        {PRIMARY_NAV.map((item) => {
          const badge =
            item.href === "/tracker" && urgentCount > 0
              ? urgentCount
              : item.href === "/goals" && overdueGoals.length > 0
              ? overdueGoals.length
              : undefined;
          return <NavLink key={item.href} item={item} badge={badge} />;
        })}
        <div className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
              isInMore ? "bg-[hsl(263_90%_65%/0.2)] text-[hsl(263_90%_75%)]" : "text-[hsl(0_0%_72%)] active:bg-[hsl(0_0%_12%)]"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">More</span>
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-[56]" onClick={() => setMoreOpen(false)} />
              <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-[hsl(0_0%_28%)] bg-[hsl(0_0%_13%)] p-2 shadow-xl z-[57]">
                {MORE_NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const badge =
                    item.href === "/knowledge-base" && dueCount > 0 ? dueCount : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                        isActive ? "bg-[hsl(263_90%_65%/0.2)] text-[hsl(263_90%_75%)]" : "text-[hsl(0_0%_85%)] hover:bg-[hsl(0_0%_20%)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {badge !== undefined && badge > 0 && (
                        <span className="ml-auto text-[10px] bg-[hsl(263_90%_60%)] text-white px-1.5 py-0.5 rounded-full">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
