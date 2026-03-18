"use client";

import { MediaGrid } from "@/components/watch-list/media-grid";
import { api } from "../../../convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { Database, Pencil, PlaySquare, RefreshCw, Sparkles, X, Check } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

function TasteModal({ onClose }: { onClose: () => void }) {
  const tasteSummary = useQuery(api.tasteSummary.get);
  const generateTasteSummary = useAction(api.ai.generateTasteSummary);
  const setTasteSummary = useMutation(api.tasteSummary.set);
  const [isRefreshing, startRefresh] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleRefresh() {
    startRefresh(async () => {
      const result = await generateTasteSummary({});
      if (result.success) toast.success("Taste summary updated");
      else toast.error(result.error ?? "Failed to update");
    });
  }

  function startEdit() {
    setEditText(tasteSummary?.summary ?? "");
    setEditing(true);
  }

  function handleSave() {
    if (!editText.trim()) return;
    startSave(async () => {
      await setTasteSummary({ summary: editText.trim(), updatedAt: new Date().toISOString() });
      setEditing(false);
      toast.success("Summary saved");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[hsl(0_0%_11%)] border border-[hsl(0_0%_22%)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(0_0%_20%)]">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Taste Profile</h3>
            {tasteSummary?.updatedAt && (
              <p className="text-[10px] text-[hsl(0_0%_50%)]">Updated {new Date(tasteSummary.updatedAt).toLocaleDateString()}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <>
                <button onClick={startEdit} title="Edit manually"
                  className="p-1.5 rounded-lg text-[hsl(0_0%_55%)] hover:text-white hover:bg-[hsl(0_0%_16%)] transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleRefresh} disabled={isRefreshing} title="Regenerate with AI"
                  className="p-1.5 rounded-lg text-[hsl(0_0%_55%)] hover:text-violet-400 hover:bg-[hsl(0_0%_16%)] transition-colors disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[hsl(0_0%_55%)] hover:text-white hover:bg-[hsl(0_0%_16%)] transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={6}
                autoFocus
                className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_55%)] outline-none resize-none focus:border-[hsl(263_90%_60%/0.5)]"
                placeholder="Describe your taste for the chatbot…"
              />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={isSaving || !editText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-[hsl(0_0%_14%)] hover:bg-[hsl(0_0%_18%)] text-[hsl(0_0%_68%)] text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : tasteSummary?.summary ? (
            <p className="text-sm text-[hsl(0_0%_78%)] leading-relaxed whitespace-pre-wrap">{tasteSummary.summary}</p>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-[hsl(0_0%_55%)] mb-3">No taste profile yet.</p>
              <button onClick={handleRefresh} disabled={isRefreshing}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                {isRefreshing ? "Generating…" : "Generate with AI"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WatchListPage() {
  const tasteSummary = useQuery(api.tasteSummary.get);
  const triggerEnrichment = useAction(api.tmdbEnrichment.triggerEnrichmentNow);
  const [isEnriching, setIsEnriching] = useState(false);
  const [tasteOpen, setTasteOpen] = useState(false);

  function handleTriggerEnrichment() {
    setIsEnriching(true);
    triggerEnrichment({})
      .then(({ scheduled }) => {
        if (scheduled > 0) toast.success(`TMDB enrichment scheduled for ${scheduled} items`);
        else toast.info("No items need TMDB metadata");
      })
      .catch(() => toast.error("Failed to trigger enrichment"))
      .finally(() => setIsEnriching(false));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-8">
      {tasteOpen && <TasteModal onClose={() => setTasteOpen(false)} />}

      <div className="mb-2 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-sky-900/30 flex items-center justify-center shrink-0">
            <PlaySquare className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-semibold text-white">Watch List</h1>
          </div>
          <button
            onClick={handleTriggerEnrichment}
            disabled={isEnriching}
            className="flex items-center gap-1.5 text-xs text-[hsl(0_0%_64%)] hover:text-violet-400 transition-colors disabled:opacity-50"
            title="Fetch TMDB metadata for items without it"
          >
            <Database className={`w-3.5 h-3.5 ${isEnriching ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">Fetch TMDB</span>
          </button>
          <button
            onClick={() => setTasteOpen(true)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              tasteSummary?.summary
                ? "text-violet-400 hover:text-violet-300"
                : "text-[hsl(0_0%_64%)] hover:text-violet-400"
            }`}
            title="View / edit taste profile"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Taste</span>
          </button>
        </div>
        <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] mt-0.5 sm:mt-1 ml-8 sm:ml-11">
          <span className="sm:hidden">Drag to reorder. Mark watched.</span>
          <span className="hidden sm:inline">Drag to reorder. Mark watched for opinions. Send icon adds review to chat.</span>
        </p>
      </div>

      <MediaGrid />
    </div>
  );
}
