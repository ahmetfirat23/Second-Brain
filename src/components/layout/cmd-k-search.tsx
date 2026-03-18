"use client";

import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { BarChart3, BookOpen, Brain, Clock, Layers, ListTodo, PlaySquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TYPE_ICONS = {
  "Brain Dump": Brain,
  "Daily Todos": ListTodo,
  "Watch List": PlaySquare,
  Tracker: Clock,
  Vault: Layers,
  "Knowledge Base": BookOpen,
  "API Usage": BarChart3,
} as const;

const TYPE_COLORS = {
  "Brain Dump": "text-[hsl(0_0%_55%)]",
  "Daily Todos": "text-[hsl(0_0%_55%)]",
  "Watch List": "text-[hsl(0_0%_55%)]",
  Tracker: "text-[hsl(0_0%_55%)]",
  Vault: "text-[hsl(0_0%_55%)]",
  "Knowledge Base": "text-[hsl(0_0%_55%)]",
  "API Usage": "text-[hsl(0_0%_55%)]",
} as const;

type SearchResult = { id: string; title: string; subtitle: string; type: string; href: string };

interface CmdKSearchProps {
  open: boolean;
  onClose: () => void;
}

export function CmdKSearch({ open, onClose }: CmdKSearchProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useQuery(api.search.globalSearch, open ? { q: query } : "skip") ?? [];

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [results]);

  function handleSelect(result: SearchResult) {
    router.push(result.href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      handleSelect(results[selected]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl rounded-xl border border-[hsl(0_0%_28%)] bg-[hsl(0_0%_10%)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(0_0%_22%)]">
          <Brain className="w-4 h-4 text-[hsl(0_0%_68%)] shrink-0" />
          <input ref={inputRef} type="text" placeholder="Search everything…" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[hsl(0_0%_64%)] outline-none" />
          <kbd className="text-[10px] bg-[hsl(0_0%_12%)] border border-[hsl(0_0%_28%)] rounded px-1.5 py-0.5 text-[hsl(0_0%_68%)]">ESC</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {query && results.length === 0 && (
            <p className="text-center text-sm text-[hsl(0_0%_64%)] py-8">No results for &ldquo;{query}&rdquo;</p>
          )}
          {!query && (
            <p className="text-center text-sm text-[hsl(0_0%_64%)] py-8">Type to search across all modules…</p>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
            const color = TYPE_COLORS[type as keyof typeof TYPE_COLORS];
            return (
              <div key={type} className="mb-2">
                <div className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${color}`}>
                  {Icon && <Icon className="w-3 h-3" />} {type}
                </div>
                {items.map((result) => {
                  const flatIdx = results.indexOf(result);
                  return (
                    <button key={result.id} onClick={() => handleSelect(result)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${flatIdx === selected ? "bg-[hsl(263_90%_65%/0.15)] text-white" : "hover:bg-[hsl(0_0%_14%)] text-[hsl(0_0%_75%)]"}`}>
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-[hsl(0_0%_68%)] truncate mt-0.5">{result.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
