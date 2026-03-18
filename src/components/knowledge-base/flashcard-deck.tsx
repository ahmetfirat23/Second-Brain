"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation, useAction } from "convex/react";
import katex from "katex";
import {
  BookOpen, BrainCircuit, Check, Layers, Loader2, Pencil, Plus,
  RefreshCw, Tag, Trash2, X,
} from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";

function renderLatex(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (_, block, inline) => {
    try {
      return katex.renderToString(block ?? inline, { displayMode: !!block, throwOnError: false });
    } catch {
      return block ?? inline;
    }
  });
}

function MathContent({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderLatex(text) }} />;
}

type Card = {
  _id: Id<"knowledgeCards">;
  front: string; back: string;
  easeFactor: number; interval: number; repetitions: number;
  nextReview: string; topic?: string;
};

const RATING_BUTTONS = [
  { rating: 0 as const, label: "Forgot", color: "bg-red-900/40 hover:bg-red-900/60 text-red-400 border-red-800/50" },
  { rating: 1 as const, label: "Hard", color: "bg-orange-900/40 hover:bg-orange-900/60 text-orange-400 border-orange-800/50" },
  { rating: 2 as const, label: "Good", color: "bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/50" },
  { rating: 3 as const, label: "Easy", color: "bg-sky-900/40 hover:bg-sky-900/60 text-sky-400 border-sky-800/50" },
];

type CatPhase =
  | { phase: "idle" }
  | { phase: "proposing" }
  | { phase: "reviewing"; topics: string[] }
  | { phase: "assigning" }
  | { phase: "done"; assigned: number };

function ReviewCard({ card, onRate }: { card: Card; onRate: (rating: 0 | 1 | 2 | 3) => void }) {
  const [flipped, setFlipped] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRate(rating: 0 | 1 | 2 | 3) {
    startTransition(() => { onRate(rating); setFlipped(false); });
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      <div className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_13%)] rounded-2xl p-8 cursor-pointer select-none min-h-[200px] flex items-center justify-center"
        onClick={() => setFlipped((f) => !f)}>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-[hsl(0_0%_68%)] mb-4">{flipped ? "Answer" : "Question"}</p>
          <div className="text-lg text-white leading-relaxed">
            <MathContent text={flipped ? card.back : card.front} />
          </div>
          {!flipped && <p className="mt-4 text-xs text-[hsl(0_0%_68%)]">Click to reveal</p>}
        </div>
      </div>
      {flipped ? (
        <div className="grid grid-cols-4 gap-2 w-full">
          {RATING_BUTTONS.map(({ rating, label, color }) => (
            <button key={rating} onClick={() => handleRate(rating)} disabled={isPending}
              className={`py-3 rounded-xl border text-sm font-medium transition-colors ${color} disabled:opacity-50`}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[hsl(0_0%_68%)]">Interval: {card.interval}d · Ease: {card.easeFactor.toFixed(1)}</p>
      )}
    </div>
  );
}

function CardEditor({ onDone }: { onDone: () => void }) {
  const createCard = useMutation(api.knowledgeCards.create);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!front.trim() || !back.trim()) return;
    startTransition(async () => {
      await createCard({ front: front.trim(), back: back.trim() });
      setFront(""); setBack("");
      onDone();
    });
  }

  return (
    <div className="bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.3)] rounded-xl p-4 space-y-3 mb-6">
      <h3 className="text-sm font-medium text-white">New Card</h3>
      <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} placeholder="Front — question or concept. Supports $LaTeX$" className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_68%)] outline-none resize-none font-mono" />
      <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} placeholder="Back — answer or definition. Supports $$LaTeX$$" className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_68%)] outline-none resize-none font-mono" />
      {(front || back) && (
        <div className="bg-[hsl(0_0%_5%)] rounded-lg p-3 text-xs">
          <p className="text-[hsl(0_0%_68%)] mb-1">Preview:</p>
          {front && <p className="text-white mb-1"><MathContent text={front} /></p>}
          {back && <p className="text-[hsl(0_0%_68%)]"><MathContent text={back} /></p>}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!front.trim() || !back.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium"><Check className="w-3.5 h-3.5" /> Add Card</button>
        <button onClick={onDone} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_68%)] text-sm"><X className="w-3.5 h-3.5" /> Cancel</button>
      </div>
    </div>
  );
}

export function FlashcardDeck() {
  const allCards = useQuery(api.knowledgeCards.list) ?? [];
  const dueCards = useQuery(api.knowledgeCards.getDue) ?? [];
  const settings = useQuery(api.chatContext.getSettings);
  const reviewCard = useMutation(api.knowledgeCards.review);
  const removeCard = useMutation(api.knowledgeCards.remove);
  const setSeedTopics = useMutation(api.chatContext.setSeedTopics);
  const proposeTopicsFn = useAction(api.ai.proposeTopics);
  const assignCardsToTopicsFn = useAction(api.ai.assignCardsToTopics);

  const [mode, setMode] = useState<"all" | "review">("all");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showTopicsPanel, setShowTopicsPanel] = useState(false);
  const [catState, setCatState] = useState<CatPhase>({ phase: "idle" });
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [newSeedInput, setNewSeedInput] = useState("");

  const seedTopics = settings?.knowledgeSeedTopics ?? [];

  const allTopics = useMemo(
    () => [...new Set(allCards.map((c) => c.topic).filter(Boolean))].sort() as string[],
    [allCards]
  );
  const uncategorizedCount = allCards.filter((c) => !c.topic).length;

  const displayedCards = useMemo(() => {
    if (selectedTopic === "__uncategorized__") return allCards.filter((c) => !c.topic);
    if (selectedTopic) return allCards.filter((c) => c.topic === selectedTopic);
    return allCards;
  }, [allCards, selectedTopic]);

  // Review only the due cards matching the current topic filter
  const filteredDueCards = useMemo(() => {
    if (selectedTopic === "__uncategorized__") return dueCards.filter((c) => !c.topic);
    if (selectedTopic) return dueCards.filter((c) => c.topic === selectedTopic);
    return dueCards;
  }, [dueCards, selectedTopic]);

  const handleRate = useCallback((rating: 0 | 1 | 2 | 3) => {
    const card = filteredDueCards[reviewIdx];
    if (!card) return;
    reviewCard({ id: card._id, rating }).then(() => {
      if (reviewIdx >= filteredDueCards.length - 1) setMode("all");
      else setReviewIdx((i) => i + 1);
    });
  }, [filteredDueCards, reviewIdx, reviewCard]);

  async function handleIncrementalCategorize() {
    setCatState({ phase: "assigning" });
    try {
      const result = await assignCardsToTopicsFn({ topics: [], mode: "incremental" });
      setCatState({ phase: "done", assigned: result.assigned });
    } catch {
      setCatState({ phase: "idle" });
    }
  }

  async function handleProposeTopics() {
    setCatState({ phase: "proposing" });
    try {
      const result = await proposeTopicsFn({ seedTopics: seedTopics.length > 0 ? seedTopics : undefined });
      setEditTopics(result.topics);
      setCatState({ phase: "reviewing", topics: result.topics });
    } catch {
      setCatState({ phase: "idle" });
    }
  }

  function addSeedTopic() {
    const t = newSeedInput.trim();
    if (!t || seedTopics.includes(t)) { setNewSeedInput(""); return; }
    setSeedTopics({ topics: [...seedTopics, t] });
    setNewSeedInput("");
  }

  function removeSeedTopic(t: string) {
    setSeedTopics({ topics: seedTopics.filter((s) => s !== t) });
  }

  async function handleAssignToTopics() {
    setCatState({ phase: "assigning" });
    try {
      const result = await assignCardsToTopicsFn({ topics: editTopics, mode: "scratch" });
      setCatState({ phase: "done", assigned: result.assigned });
      setSelectedTopic(null);
    } catch {
      setCatState({ phase: "idle" });
    }
  }

  function addEditTopic() {
    const t = newTopicInput.trim();
    if (t && !editTopics.includes(t)) setEditTopics((p) => [...p, t]);
    setNewTopicInput("");
  }

  const currentCard = filteredDueCards[reviewIdx];
  const reviewProgress = filteredDueCards.length > 0 ? `${reviewIdx + 1} / ${filteredDueCards.length}` : "0";

  return (
    <div>
      {/* Header actions */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-1">
          <button onClick={() => { setMode("all"); setShowAdd(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "all" ? "bg-[hsl(0_0%_12%)] text-white" : "text-[hsl(0_0%_72%)] hover:text-white"}`}>
            <Layers className="w-4 h-4" /> All Cards <span className="text-[hsl(0_0%_64%)] font-normal">({allCards.length})</span>
          </button>
          <button onClick={() => { setMode("review"); setReviewIdx(0); setShowAdd(false); }}
            disabled={filteredDueCards.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${mode === "review" ? "bg-[hsl(263_90%_60%/0.2)] text-[hsl(263_70%_75%)]" : "text-[hsl(0_0%_72%)] hover:text-white"}`}>
            <BrainCircuit className="w-4 h-4" /> Review
            {filteredDueCards.length > 0 && <span className="bg-[hsl(263_90%_60%)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredDueCards.length}</span>}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowTopicsPanel((v) => !v); setCatState({ phase: "idle" }); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${showTopicsPanel ? "bg-[hsl(263_90%_60%/0.15)] text-[hsl(263_70%_75%)]" : "text-[hsl(0_0%_68%)] hover:text-white border border-dashed border-[hsl(0_0%_28%)] hover:border-[hsl(0_0%_30%)]"}`}
          >
            <Tag className="w-4 h-4" /> Topics
          </button>
          {!showAdd && mode === "all" && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 text-sm text-[hsl(0_0%_68%)] hover:text-white border border-dashed border-[hsl(0_0%_28%)] hover:border-[hsl(0_0%_30%)] rounded-lg px-4 py-2 transition-all">
              <Plus className="w-4 h-4" /> New Card
            </button>
          )}
        </div>
      </div>

      {/* Topics management panel */}
      {showTopicsPanel && (
        <div className="mb-6 bg-[hsl(0_0%_9%)] border border-[hsl(263_90%_60%/0.2)] rounded-xl p-4 space-y-4">
          <p className="text-xs font-medium text-[hsl(0_0%_80%)] uppercase tracking-wider">Topic Management</p>

          {catState.phase === "idle" && (
            <div className="space-y-4">
              {/* Seed topics */}
              <div>
                <p className="text-xs text-[hsl(0_0%_72%)] mb-1.5 font-medium">Preferred topics</p>
                <p className="text-[11px] text-[hsl(0_0%_55%)] mb-2">
                  AI will reuse these when proposing topics, adding new ones only if needed.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {seedTopics.map((t) => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[hsl(0_0%_14%)] text-[hsl(0_0%_80%)] border border-[hsl(0_0%_25%)]">
                      {t}
                      <button onClick={() => removeSeedTopic(t)} className="hover:text-white ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      value={newSeedInput}
                      onChange={(e) => setNewSeedInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSeedTopic(); } }}
                      placeholder="Add topic…"
                      className="px-2 py-1 rounded-lg text-xs bg-[hsl(0_0%_12%)] border border-[hsl(0_0%_25%)] text-white placeholder:text-[hsl(0_0%_50%)] outline-none w-28"
                    />
                    <button onClick={addSeedTopic} className="p-1 text-[hsl(0_0%_60%)] hover:text-white">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="w-full h-px bg-[hsl(0_0%_18%)]" />
              {/* Categorize actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <p className="text-xs text-[hsl(0_0%_72%)] mb-1.5 font-medium">Incremental</p>
                  <p className="text-[11px] text-[hsl(0_0%_55%)] mb-2">
                    Assigns {uncategorizedCount} uncategorized {uncategorizedCount === 1 ? "card" : "cards"} to existing topics. New topics created as needed.
                  </p>
                  <button
                    onClick={handleIncrementalCategorize}
                    disabled={uncategorizedCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_14%)] hover:bg-[hsl(0_0%_18%)] disabled:opacity-40 text-sm text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Categorize new cards
                  </button>
                </div>
                <div className="w-px bg-[hsl(0_0%_18%)] hidden sm:block" />
                <div className="flex-1">
                  <p className="text-xs text-[hsl(0_0%_72%)] mb-1.5 font-medium">From scratch</p>
                  <p className="text-[11px] text-[hsl(0_0%_55%)] mb-2">
                    AI proposes topics from all {allCards.length} cards{seedTopics.length > 0 ? `, starting from your ${seedTopics.length} preferred topic${seedTopics.length > 1 ? "s" : ""}` : ""}. You review before assigning.
                  </p>
                  <button
                    onClick={handleProposeTopics}
                    disabled={allCards.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%/0.15)] hover:bg-[hsl(263_90%_60%/0.25)] disabled:opacity-40 text-sm text-[hsl(263_70%_75%)] transition-colors border border-[hsl(263_90%_60%/0.2)]"
                  >
                    <Tag className="w-3.5 h-3.5" /> Propose topics
                  </button>
                </div>
              </div>
            </div>
          )}

          {(catState.phase === "proposing" || catState.phase === "assigning") && (
            <div className="flex items-center gap-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-[hsl(263_70%_70%)]" />
              <span className="text-sm text-[hsl(0_0%_72%)]">
                {catState.phase === "proposing" ? "Analyzing cards and proposing topics…" : "Assigning cards to topics…"}
              </span>
            </div>
          )}

          {catState.phase === "reviewing" && (
            <div className="space-y-3">
              <p className="text-xs text-[hsl(0_0%_72%)]">
                Review proposed topics. Edit, remove, or add before assigning all {allCards.length} cards.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {editTopics.map((topic) => (
                  <span key={topic} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[hsl(263_90%_60%/0.15)] text-[hsl(263_70%_75%)] border border-[hsl(263_90%_60%/0.25)]">
                    {topic}
                    <button onClick={() => setEditTopics((p) => p.filter((t) => t !== topic))} className="hover:text-white ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    value={newTopicInput}
                    onChange={(e) => setNewTopicInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditTopic(); } }}
                    placeholder="Add topic…"
                    className="px-2 py-1 rounded-lg text-xs bg-[hsl(0_0%_12%)] border border-[hsl(0_0%_25%)] text-white placeholder:text-[hsl(0_0%_50%)] outline-none w-28"
                  />
                  <button onClick={addEditTopic} className="p-1 text-[hsl(0_0%_60%)] hover:text-white">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAssignToTopics}
                  disabled={editTopics.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" /> Assign cards to these topics
                </button>
                <button onClick={() => setCatState({ phase: "idle" })} className="px-3 py-2 rounded-lg text-sm text-[hsl(0_0%_68%)] hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {catState.phase === "done" && (
            <div className="flex items-center gap-3">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-[hsl(0_0%_80%)]">
                Assigned {catState.assigned} {catState.assigned === 1 ? "card" : "cards"} to topics.
              </span>
              <button onClick={() => setCatState({ phase: "idle" })} className="text-xs text-[hsl(0_0%_60%)] hover:text-white ml-auto">
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {showAdd && <CardEditor onDone={() => setShowAdd(false)} />}

      {mode === "review" && (
        <div>
          {filteredDueCards.length === 0 ? (
            <div className="text-center py-20 text-[hsl(0_0%_68%)]">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">All caught up! No cards due for review.</p>
            </div>
          ) : currentCard ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs text-[hsl(0_0%_68%)]">Progress: {reviewProgress}</p>
                <div className="flex-1 max-w-xs mx-4 bg-[hsl(0_0%_12%)] rounded-full h-1.5">
                  <div className="bg-[hsl(263_90%_60%)] h-1.5 rounded-full transition-all" style={{ width: `${(reviewIdx / filteredDueCards.length) * 100}%` }} />
                </div>
                <button onClick={() => setMode("all")} className="text-xs text-[hsl(0_0%_64%)] hover:text-white">Exit</button>
              </div>
              <ReviewCard card={currentCard} onRate={handleRate} />
            </div>
          ) : null}
        </div>
      )}

      {mode === "all" && (
        <div>
          {/* Topic filter pills */}
          {allTopics.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              <button
                onClick={() => setSelectedTopic(null)}
                className={`px-3 py-1 rounded-full text-xs transition-colors border ${selectedTopic === null ? "bg-[hsl(263_90%_60%/0.2)] text-[hsl(263_70%_75%)] border-[hsl(263_90%_60%/0.3)]" : "bg-[hsl(0_0%_10%)] text-[hsl(0_0%_68%)] hover:text-white border-transparent"}`}
              >
                All ({allCards.length})
              </button>
              {allTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors border ${selectedTopic === topic ? "bg-[hsl(263_90%_60%/0.2)] text-[hsl(263_70%_75%)] border-[hsl(263_90%_60%/0.3)]" : "bg-[hsl(0_0%_10%)] text-[hsl(0_0%_68%)] hover:text-white border-transparent"}`}
                >
                  {topic} ({allCards.filter((c) => c.topic === topic).length})
                </button>
              ))}
              {uncategorizedCount > 0 && (
                <button
                  onClick={() => setSelectedTopic(selectedTopic === "__uncategorized__" ? null : "__uncategorized__")}
                  className={`px-3 py-1 rounded-full text-xs transition-colors border ${selectedTopic === "__uncategorized__" ? "bg-amber-900/30 text-amber-400 border-amber-800/40" : "bg-[hsl(0_0%_10%)] text-[hsl(0_0%_68%)] hover:text-white border-transparent"}`}
                >
                  Uncategorized ({uncategorizedCount})
                </button>
              )}
            </div>
          )}

          {displayedCards.length === 0 ? (
            <div className="text-center py-20 text-[hsl(0_0%_68%)]">
              <BrainCircuit className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No cards yet. Add one above or use Brain Dump.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedCards.map((card) => (
                <CardRow key={card._id} card={card} onRemove={() => { if (confirm("Delete this card?")) removeCard({ id: card._id }); }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CardRow({ card, onRemove }: { card: Card; onRemove: () => void }) {
  const updateCard = useMutation(api.knowledgeCards.update);
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];
  const isDue = card.nextReview <= today;

  function handleSave() {
    startTransition(async () => {
      await updateCard({ id: card._id, front, back });
      setEditing(false);
    });
  }

  return (
    <div className={`bg-[hsl(0_0%_10%)] border rounded-xl p-4 hover:border-[hsl(0_0%_28%)] transition-all ${isDue ? "border-[hsl(263_60%_40%/0.4)]" : "border-[hsl(0_0%_22%)]"}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5 text-sm text-white outline-none resize-none font-mono" />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-1.5 text-sm text-[hsl(0_0%_70%)] outline-none resize-none font-mono" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%)] text-white text-xs font-medium"><Check className="w-3 h-3" /> Save</button>
            <button onClick={() => { setFront(card.front); setBack(card.back); setEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_68%)] text-xs"><X className="w-3 h-3" /> Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white mb-1"><MathContent text={card.front} /></p>
            <p className="text-sm text-[hsl(0_0%_64%)]"><MathContent text={card.back} /></p>
            {card.topic && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] bg-[hsl(263_90%_60%/0.12)] text-[hsl(263_65%_68%)] border border-[hsl(263_90%_60%/0.2)]">
                <Tag className="w-2.5 h-2.5" />{card.topic}
              </span>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1 text-right">
            {isDue
              ? <span className="text-[10px] font-semibold text-[hsl(263_70%_70%)] uppercase tracking-wider">Due</span>
              : <span className="text-[10px] text-[hsl(0_0%_68%)]">{card.nextReview}</span>}
            <span className="text-[10px] text-[hsl(0_0%_68%)]">×{card.repetitions}</span>
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-[hsl(0_0%_18%)] text-[hsl(0_0%_45%)] hover:text-white transition-colors"><Pencil className="w-3 h-3" /></button>
            <button onClick={onRemove} className="p-1 rounded hover:bg-red-900/40 text-[hsl(0_0%_45%)] hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
