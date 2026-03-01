"use client";

import { MediaGrid } from "@/components/watch-list/media-grid";
import { api } from "../../../convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Database, Pencil, PlaySquare, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export default function WatchListPage() {
  const tasteSummary = useQuery(api.tasteSummary.get);
  const generateTasteSummary = useAction(api.ai.generateTasteSummary);
  const setTasteSummary = useMutation(api.tasteSummary.set);
  const triggerEnrichment = useAction(api.tmdbEnrichment.triggerEnrichmentNow);
  const [isRefreshing, startTransition] = useTransition();
  const [isEnriching, setIsEnriching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isSaving, startSave] = useTransition();

  function handleRefreshTaste() {
    startTransition(async () => {
      const result = await generateTasteSummary({});
      if (result.success) {
        toast.success("Taste summary updated");
      } else {
        toast.error(result.error ?? "Failed to update");
      }
    });
  }

  function handleTriggerEnrichment() {
    setIsEnriching(true);
    triggerEnrichment({})
      .then(({ scheduled }) => {
        if (scheduled > 0) {
          toast.success(`TMDB enrichment scheduled for ${scheduled} items`);
        } else {
          toast.info("No items need TMDB metadata");
        }
      })
      .catch(() => toast.error("Failed to trigger enrichment"))
      .finally(() => setIsEnriching(false));
  }

  function startEdit() {
    setEditText(tasteSummary?.summary ?? "");
    setEditing(true);
  }

  function handleSaveEdit() {
    if (!editText.trim()) return;
    startSave(async () => {
      await setTasteSummary({ summary: editText.trim(), updatedAt: new Date().toISOString() });
      setEditing(false);
      toast.success("Summary saved");
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-900/30 flex items-center justify-center">
              <PlaySquare className="w-4 h-4 text-sky-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Watch List</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerEnrichment}
              disabled={isEnriching}
              className="flex items-center gap-1.5 text-xs text-[hsl(0_0%_45%)] hover:text-violet-400 transition-colors disabled:opacity-50"
              title="Fetch TMDB metadata for items without it"
            >
              <Database className={`w-3.5 h-3.5 ${isEnriching ? "animate-pulse" : ""}`} />
              Fetch TMDB
            </button>
            <button
              onClick={handleRefreshTaste}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs text-[hsl(0_0%_45%)] hover:text-violet-400 transition-colors disabled:opacity-50"
              title="Regenerate taste summary for the chatbot"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh taste
            </button>
          </div>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          Drag to reorder. Mark as watched to add opinions. Use the send icon to include a review in chat.
        </p>
      </div>

      {/* Taste summary */}
      <div className="mb-6 rounded-xl border border-[hsl(0_0%_15%)] bg-[hsl(0_0%_8%)] overflow-hidden">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[hsl(0_0%_10%)] transition-colors"
        >
          <span className="text-sm font-medium text-white">Taste summary</span>
          <span className="text-xs text-[hsl(0_0%_45%)]">
            {tasteSummary?.updatedAt ? new Date(tasteSummary.updatedAt).toLocaleDateString() : "Not generated"}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-[hsl(0_0%_40%)]" /> : <ChevronDown className="w-4 h-4 text-[hsl(0_0%_40%)]" />}
        </button>
        {expanded && (
          <div className="px-4 pb-4 pt-0 border-t border-[hsl(0_0%_12%)]">
            {editing ? (
              <div className="space-y-3 pt-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={6}
                  className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none resize-none"
                  placeholder="Your taste summary for the chatbot…"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-3">
                {tasteSummary?.summary ? (
                  <>
                    <p className="text-sm text-[hsl(0_0%_75%)] leading-relaxed whitespace-pre-wrap">{tasteSummary.summary}</p>
                    <button
                      onClick={startEdit}
                      className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(0_0%_45%)] hover:text-violet-400 transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </>
                ) : (
                  <div className="pt-3">
                    <p className="text-sm text-[hsl(0_0%_45%)]">
                      No summary yet. Click &quot;Refresh taste&quot; to generate one, or write your own.
                    </p>
                    <button
                      onClick={startEdit}
                      className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(0_0%_45%)] hover:text-violet-400 transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit / Create
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <MediaGrid />
    </div>
  );
}
