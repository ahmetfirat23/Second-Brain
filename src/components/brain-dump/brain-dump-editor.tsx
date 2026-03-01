"use client";

import { fanOutDump, saveBrainDump, tidyAllPending, tidyBrainDumpText, uncheckDump, updateDumpAndReGroup } from "@/actions/brain-dump";
import { api } from "../../../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";

import { format } from "date-fns";
import {
  ArrowRight, CheckCheck, ChevronDown, ChevronRight, Clock,
  GitMerge, Loader2, Pencil, RotateCcw, Send, Sparkles, Trash2, X
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type TidyPreview = { dumpId: string; original: string; title: string; tidiedContent: string };

export function BrainDumpEditor() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, startSave] = useTransition();
  const [isTidying, startTidy] = useTransition();
  const [isFanningOut, startFanOut] = useTransition();
  const [isTidyingAll, startTidyAll] = useTransition();
  const [preview, setPreview] = useState<TidyPreview | null>(null);
  const [showDone, setShowDone] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const dumps = useQuery(api.brainDumps.list) ?? [];
  const pendingCount = useQuery(api.brainDumps.getPendingCount) ?? 0;
  const toggleNoMerge = useMutation(api.brainDumps.toggleNoMerge);
  const updateDump = useMutation(api.brainDumps.update);
  const removeDump = useMutation(api.brainDumps.remove);
  const chatCtx = useQuery(api.chatContext.getSettings);
  const setAiPreferences = useMutation(api.chatContext.setAiPreferences);
  const provider = chatCtx?.aiProvider ?? "grok";

  function handleSave() {
    if (!body.trim()) return;
    startSave(async () => {
      try {
        await saveBrainDump(body.trim(), title.trim() || undefined);
        setTitle(""); setBody("");
        toast.success("Saved");
      } catch {
        toast.error("Failed to save");
      }
    });
  }

  function handleTidy() {
    if (!body.trim()) return;
    startTidy(async () => {
      const id = await saveBrainDump(body.trim(), title.trim() || undefined);
      const result = await tidyBrainDumpText(id, body.trim(), title.trim() || undefined);
      if (!result.success) { toast.error(result.error ?? "Tidy failed"); return; }
      setPreview({ dumpId: id, original: body.trim(), title: result.title!, tidiedContent: result.tidiedContent! });
      setTitle(""); setBody("");
    });
  }

  function handleAcceptTidy() {
    if (!preview) return;
    toast.success("Using tidied version");
    setPreview(null);
  }

  function handleRejectTidy() {
    if (!preview) return;
    setTitle(preview.title); setBody(preview.original);
    setPreview(null);
  }

  function handleGroup(dumpId: string, content: string) {
    startFanOut(async () => {
      const result = await fanOutDump(dumpId, content);
      if (!result.success) { toast.error(result.error ?? "Group failed"); return; }
      const s = result.summary!;
      const parts: string[] = [];
      if (s.deadlines > 0) parts.push(`${s.deadlines} deadline${s.deadlines !== 1 ? "s" : ""}`);
      if (s.media > 0) parts.push(`${s.media} title${s.media !== 1 ? "s" : ""}`);
      if (s.knowledge_cards > 0) parts.push(`${s.knowledge_cards} card${s.knowledge_cards !== 1 ? "s" : ""}`);
      if (s.vault > 0) parts.push(`${s.vault} link${s.vault !== 1 ? "s" : ""}`);
      if (s.goals > 0) parts.push(`${s.goals} goal${s.goals !== 1 ? "s" : ""}`);
      const total = s.deadlines + s.media + s.knowledge_cards + s.vault + s.goals;
      if (total === 0) toast("Nothing to group — try adding deadlines, media, goals, or links.");
      else toast.success(parts.join(" · "), { description: "Grouping complete!", duration: 5000 });
    });
  }

  function handleTidyRow(dumpId: string, content: string, title?: string) {
    startTidy(async () => {
      const result = await tidyBrainDumpText(dumpId, content, title);
      if (!result.success) { toast.error(result.error ?? "Tidy failed"); return; }
      toast.success("Cleaned up");
    });
  }

  function handleGroupAll() {
    if (pendingCount === 0) return;
    startTidyAll(async () => {
      const result = await tidyAllPending();
      const s = result.totalAdded ?? { deadlines: 0, media: 0, knowledge_cards: 0, vault: 0, goals: 0 };
      const parts: string[] = [];
      if ((s.deadlines ?? 0) > 0) parts.push(`${s.deadlines} deadlines`);
      if ((s.media ?? 0) > 0) parts.push(`${s.media} titles`);
      if ((s.knowledge_cards ?? 0) > 0) parts.push(`${s.knowledge_cards} cards`);
      if ((s.vault ?? 0) > 0) parts.push(`${s.vault} links`);
      if ((s.goals ?? 0) > 0) parts.push(`${s.goals} goals`);
      toast.success(`Grouped ${result.processed} dump${result.processed !== 1 ? "s" : ""}`, {
        description: parts.length > 0 ? `Added: ${parts.join(", ")}` : "Nothing grouped",
        duration: 6000,
      });
    });
  }

  const activeDumps = dumps.filter((d) => !d.tidiedAt);
  const doneDumps = dumps.filter((d) => d.tidiedAt);

  return (
    <div className="flex flex-col gap-6">
      {/* Write area */}
      <div className="bg-[hsl(0_0%_13%)] border border-[hsl(0_0%_22%)] rounded-xl overflow-hidden">
        <input
          data-testid="brain-dump-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-transparent border-b border-[hsl(0_0%_20%)] px-4 py-2 text-sm font-medium text-white placeholder:text-[hsl(0_0%_58%)] outline-none"
        />
        <textarea
          ref={bodyRef}
          data-testid="brain-dump-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write anything… facts, links, todos, ideas"
          rows={2}
          disabled={isTidying || isSaving}
          className="w-full bg-transparent px-4 py-2.5 text-sm text-[hsl(0_0%_80%)] placeholder:text-[hsl(0_0%_72%)] outline-none resize-none leading-relaxed font-mono overflow-hidden"
          style={{ minHeight: "56px" }}
        />
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-[hsl(0_0%_20%)]">
          {/* AI provider toggle */}
          <div className="flex items-center gap-0.5 rounded border border-[hsl(0_0%_28%)] bg-[hsl(0_0%_10%)] p-0.5">
            {(["grok", "gpt"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAiPreferences({ aiProvider: p })}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase transition-colors ${
                  provider === p
                    ? "bg-[hsl(263_90%_60%)] text-white"
                    : "text-[hsl(0_0%_55%)] hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {(title || body) && (
              <button onClick={() => { setTitle(""); setBody(""); }}
                className="text-xs text-[hsl(0_0%_55%)] hover:text-[hsl(0_0%_75%)] transition-colors px-2 py-1">
                Clear
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!body.trim() || isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[hsl(0_0%_16%)] hover:bg-[hsl(0_0%_22%)] disabled:opacity-40 text-[hsl(0_0%_68%)] text-xs transition-colors"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Save
            </button>
            <button
              data-testid="brain-dump-tidy"
              onClick={handleTidy}
              disabled={!body.trim() || isTidying}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[hsl(263_90%_60%/0.15)] hover:bg-[hsl(263_90%_60%/0.25)] disabled:opacity-40 text-[hsl(263_70%_75%)] text-xs font-medium transition-colors border border-[hsl(263_90%_60%/0.3)]"
            >
              {isTidying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isTidying ? "Tidying…" : "Tidy"}
            </button>
          </div>
        </div>
      </div>

      {/* Tidy preview */}
      {preview && (
        <div className="border border-[hsl(263_90%_60%/0.3)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[hsl(263_90%_60%/0.08)] border-b border-[hsl(263_90%_60%/0.2)]">
            <span className="text-sm font-medium text-[hsl(263_70%_75%)] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Tidy result
            </span>
            <button onClick={() => setPreview(null)} className="text-[hsl(0_0%_68%)] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[hsl(0_0%_12%)]">
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(0_0%_68%)] mb-2">Original</p>
              <p className="text-xs text-[hsl(0_0%_72%)] leading-relaxed font-mono whitespace-pre-wrap line-clamp-6">{preview.original}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(263_70%_60%)] mb-1">Tidied · {preview.title}</p>
              <p className="text-xs text-[hsl(0_0%_75%)] leading-relaxed whitespace-pre-wrap line-clamp-6">{preview.tidiedContent}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[hsl(0_0%_22%)]">
            <button onClick={handleRejectTidy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] text-[hsl(0_0%_64%)] text-xs hover:bg-[hsl(0_0%_14%)]">
              <X className="w-3 h-3" /> Keep original
            </button>
            <button onClick={handleAcceptTidy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%)] text-white text-xs font-medium hover:bg-[hsl(263_90%_65%)]">
              <CheckCheck className="w-3 h-3" /> Use this
            </button>
          </div>
        </div>
      )}

      {/* Pending group banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_24%)] rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-[hsl(0_0%_68%)]">
            <Clock className="w-4 h-4" />
            <span><span className="font-semibold text-white">{pendingCount}</span> {pendingCount === 1 ? "dump" : "dumps"} not yet grouped</span>
          </div>
          <button
            onClick={handleGroupAll}
            disabled={isTidyingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isTidyingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
            {isTidyingAll ? "Running…" : "Group All"}
          </button>
        </div>
      )}

      {/* Active dumps */}
      {activeDumps.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[hsl(0_0%_68%)] uppercase tracking-wider mb-2">
            Saved ({activeDumps.length})
          </p>
          <div className="space-y-1.5">
            {activeDumps.map((d) => (
              <DumpRow
                key={d._id}
                id={d._id}
                title={d.title}
                content={d.tidiedContent ?? d.content}
                original={d.tidiedContent ? d.content : undefined}
                createdAt={d._creationTime}
                noMerge={d.noMerge ?? false}
                isGrouping={isFanningOut}
                onGroup={() => handleGroup(d._id, d.tidiedContent ?? d.content)}
                onTidy={() => handleTidyRow(d._id, d.content, d.title)}
                onUncheck={undefined}
                onSaveAndUncheck={undefined}
                onUpdateAndReGroup={undefined}
                onToggleNoMerge={() => toggleNoMerge({ id: d._id })}
                onRemove={() => { if (confirm("Delete this dump?")) removeDump({ id: d._id }); }}
                onUpdate={(updates) => {
                  const payload = d.tidiedContent ? { tidiedContent: updates.content, title: updates.title } : { content: updates.content, title: updates.title };
                  updateDump({ id: d._id, ...payload });
                  toast.success("Updated");
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Done dumps (collapsed) */}
      {doneDumps.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[hsl(0_0%_68%)] uppercase tracking-wider hover:text-[hsl(0_0%_68%)] transition-colors mb-2"
          >
            {showDone ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Grouped ({doneDumps.length})
          </button>
          {showDone && (
            <div className="space-y-1.5">
              {doneDumps.slice(0, 20).map((d) => (
                <DumpRow
                  key={d._id}
                  id={d._id}
                  title={d.title}
                  content={d.tidiedContent ?? d.content}
                  createdAt={d._creationTime}
                  noMerge={d.noMerge ?? false}
                  done
                  isGrouping={false}
                  onGroup={() => {}}
                  onTidy={() => {}}
                  onUncheck={() => {
                    startFanOut(async () => {
                      await uncheckDump(d._id);
                      toast.success("Moved back to Saved");
                    });
                  }}
                  onToggleNoMerge={() => toggleNoMerge({ id: d._id })}
                  onRemove={() => { if (confirm("Delete this dump?")) removeDump({ id: d._id }); }}
                  onUpdate={(updates) => {
                    const payload = d.tidiedContent ? { tidiedContent: updates.content, title: updates.title } : { content: updates.content, title: updates.title };
                    updateDump({ id: d._id, ...payload });
                    toast.success("Updated");
                  }}
                  onSaveAndUncheck={(updates) => {
                    startFanOut(async () => {
                      await updateDump({ id: d._id, content: updates.content!, tidiedContent: updates.content, title: updates.title });
                      await uncheckDump(d._id);
                      toast.success("Moved back to Saved");
                    });
                  }}
                  onUpdateAndReGroup={(updates) => {
                    startFanOut(async () => {
                      const result = await updateDumpAndReGroup(d._id, updates.content!, updates.title);
                      if (!result.success) { toast.error(result.error); return; }
                      const s = result.summary!;
                      const parts: string[] = [];
                      if (s.deadlines > 0) parts.push(`${s.deadlines} deadlines`);
                      if (s.media > 0) parts.push(`${s.media} titles`);
                      if (s.knowledge_cards > 0) parts.push(`${s.knowledge_cards} cards`);
                      if (s.vault > 0) parts.push(`${s.vault} links`);
                      toast.success("Updated & re-grouped", { description: parts.length > 0 ? parts.join(" · ") : undefined });
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DumpRow({
  id, title, content, original, createdAt, noMerge, done = false,
  isGrouping, onGroup, onTidy, onUncheck, onToggleNoMerge, onRemove, onUpdate, onSaveAndUncheck, onUpdateAndReGroup,
}: {
  id: string; title?: string; content: string; original?: string;
  createdAt: number; noMerge: boolean; done?: boolean;
  isGrouping: boolean; onGroup: () => void; onTidy: () => void;
  onUncheck?: () => void;
  onToggleNoMerge: () => void; onRemove: () => void;
  onUpdate: (updates: { content?: string; title?: string }) => void;
  onSaveAndUncheck?: (updates: { content: string; title?: string }) => void;
  onUpdateAndReGroup?: (updates: { content: string; title?: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title ?? "");
  const [editContent, setEditContent] = useState(content);
  const date = format(new Date(createdAt), "MMM d, HH:mm");
  const displayTitle = title ?? content.slice(0, 50) + (content.length > 50 ? "…" : "");

  function handleSaveEdit(mode: "uncheck" | "keep") {
    const newContent = editContent.trim();
    if (!newContent) return;
    if (done && mode === "uncheck" && onSaveAndUncheck) {
      onSaveAndUncheck({ content: newContent, title: editTitle.trim() || undefined });
    } else if (done && mode === "keep" && onUpdateAndReGroup) {
      onUpdateAndReGroup({ content: newContent, title: editTitle.trim() || undefined });
    } else {
      onUpdate({ content: newContent, title: editTitle.trim() || undefined });
    }
    setEditing(false);
  }

  return (
    <div className={`group rounded-lg border transition-colors ${done ? "border-transparent hover:border-[hsl(0_0%_10%)]" : "bg-[hsl(0_0%_10%)] border-[hsl(0_0%_22%)]"}`}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? "bg-emerald-700" : "bg-amber-500"}`} />
        {!editing ? (
          <>
            <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left min-w-0">
              <span className={`text-xs truncate block ${done ? "text-[hsl(0_0%_64%)]" : "text-[hsl(0_0%_72%)]"}`}>{displayTitle}</span>
            </button>
            <span className="text-[10px] text-[hsl(0_0%_64%)] shrink-0">{date}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!done && (
                <>
                  <button onClick={onTidy} title="Clean up with AI"
                    className="p-1 rounded hover:bg-[hsl(263_90%_60%/0.1)] text-[hsl(0_0%_64%)] hover:text-[hsl(263_70%_70%)] transition-colors">
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onToggleNoMerge}
                    title={noMerge ? "Allow group" : "Mark standalone"}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${noMerge ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-transparent text-[hsl(0_0%_64%)] border-[hsl(0_0%_20%)] hover:border-[hsl(0_0%_30%)]"}`}
                  >
                    {noMerge ? "Standalone" : "Solo"}
                  </button>
                  {!noMerge && (
                    <button onClick={onGroup} disabled={isGrouping} title="Group to modules"
                      className="p-1 rounded hover:bg-[hsl(263_90%_60%/0.15)] text-[hsl(0_0%_64%)] hover:text-[hsl(263_70%_70%)] disabled:opacity-40 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
              {done && onUncheck && (
                <button onClick={onUncheck} title="Move back to Saved"
                  className="p-1 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => { setEditing(true); setEditTitle(title ?? ""); setEditContent(content); }} title="Edit"
                className="p-1 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onRemove} title="Delete"
                className="p-1 rounded hover:bg-red-900/30 text-[hsl(0_0%_68%)] hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded px-2 py-1 text-xs text-white placeholder:text-[hsl(0_0%_64%)] outline-none"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded px-2 py-1 text-xs text-[hsl(0_0%_80%)] font-mono outline-none resize-none"
            />
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-[10px] text-[hsl(0_0%_72%)] hover:bg-[hsl(0_0%_20%)]">Cancel</button>
              {done && onUpdateAndReGroup ? (
                <>
                  <button onClick={() => handleSaveEdit("uncheck")} disabled={!editContent.trim()}
                    className="px-2 py-1 rounded text-[10px] text-[hsl(0_0%_64%)] hover:bg-[hsl(0_0%_20%)] disabled:opacity-40">Save & uncheck</button>
                  <button onClick={() => handleSaveEdit("keep")} disabled={!editContent.trim()}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-[hsl(263_90%_60%)] text-white hover:bg-[hsl(263_90%_65%)] disabled:opacity-40">Save & keep grouped</button>
                </>
              ) : (
                <button onClick={() => handleSaveEdit("keep")} disabled={!editContent.trim()}
                  className="px-2 py-1 rounded text-[10px] font-medium bg-[hsl(263_90%_60%)] text-white hover:bg-[hsl(263_90%_65%)] disabled:opacity-40">Save</button>
              )}
            </div>
          </div>
        )}
      </div>
      {!editing && expanded && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-[hsl(0_0%_64%)] leading-relaxed font-mono whitespace-pre-wrap">{content}</p>
          {original && (
            <details className="text-xs">
              <summary className="text-[hsl(0_0%_68%)] cursor-pointer hover:text-[hsl(0_0%_72%)]">View original</summary>
              <p className="mt-1.5 text-[hsl(0_0%_58%)] leading-relaxed font-mono whitespace-pre-wrap pl-3 border-l border-[hsl(0_0%_28%)]">{original}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
