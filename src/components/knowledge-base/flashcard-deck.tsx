"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import katex from "katex";
import { BookOpen, BrainCircuit, Check, Layers, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

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

type Card = { _id: Id<"knowledgeCards">; front: string; back: string; easeFactor: number; interval: number; repetitions: number; nextReview: string };

const RATING_BUTTONS = [
  { rating: 0 as const, label: "Forgot", color: "bg-red-900/40 hover:bg-red-900/60 text-red-400 border-red-800/50" },
  { rating: 1 as const, label: "Hard", color: "bg-orange-900/40 hover:bg-orange-900/60 text-orange-400 border-orange-800/50" },
  { rating: 2 as const, label: "Good", color: "bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/50" },
  { rating: 3 as const, label: "Easy", color: "bg-sky-900/40 hover:bg-sky-900/60 text-sky-400 border-sky-800/50" },
];

function ReviewCard({ card, onRate }: { card: Card; onRate: (rating: 0 | 1 | 2 | 3) => void }) {
  const [flipped, setFlipped] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRate(rating: 0 | 1 | 2 | 3) {
    startTransition(() => { onRate(rating); setFlipped(false); });
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      <div className="w-full bg-[hsl(0_0%_7%)] border border-[hsl(0_0%_13%)] rounded-2xl p-8 cursor-pointer select-none min-h-[200px] flex items-center justify-center"
        onClick={() => setFlipped((f) => !f)}>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-[hsl(0_0%_30%)] mb-4">{flipped ? "Answer" : "Question"}</p>
          <div className="text-lg text-white leading-relaxed">
            <MathContent text={flipped ? card.back : card.front} />
          </div>
          {!flipped && <p className="mt-4 text-xs text-[hsl(0_0%_30%)]">Click to reveal</p>}
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
        <p className="text-xs text-[hsl(0_0%_30%)]">Interval: {card.interval}d · Ease: {card.easeFactor.toFixed(1)}</p>
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
    <div className="bg-[hsl(0_0%_7%)] border border-[hsl(263_90%_60%/0.3)] rounded-xl p-4 space-y-3 mb-6">
      <h3 className="text-sm font-medium text-white">New Card</h3>
      <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} placeholder="Front — question or concept. Supports $LaTeX$" className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none resize-none font-mono" />
      <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} placeholder="Back — answer or definition. Supports $$LaTeX$$" className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_30%)] outline-none resize-none font-mono" />
      {(front || back) && (
        <div className="bg-[hsl(0_0%_5%)] rounded-lg p-3 text-xs">
          <p className="text-[hsl(0_0%_30%)] mb-1">Preview:</p>
          {front && <p className="text-white mb-1"><MathContent text={front} /></p>}
          {back && <p className="text-[hsl(0_0%_60%)]"><MathContent text={back} /></p>}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!front.trim() || !back.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium"><Check className="w-3.5 h-3.5" /> Add Card</button>
        <button onClick={onDone} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-sm"><X className="w-3.5 h-3.5" /> Cancel</button>
      </div>
    </div>
  );
}

export function FlashcardDeck() {
  const allCards = useQuery(api.knowledgeCards.list) ?? [];
  const dueCards = useQuery(api.knowledgeCards.getDue) ?? [];
  const reviewCard = useMutation(api.knowledgeCards.review);
  const removeCard = useMutation(api.knowledgeCards.remove);

  const [mode, setMode] = useState<"all" | "review">("all");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  const handleRate = useCallback((rating: 0 | 1 | 2 | 3) => {
    const card = dueCards[reviewIdx];
    if (!card) return;
    reviewCard({ id: card._id, rating }).then(() => {
      if (reviewIdx >= dueCards.length - 1) setMode("all");
      else setReviewIdx((i) => i + 1);
    });
  }, [dueCards, reviewIdx, reviewCard]);

  const currentCard = dueCards[reviewIdx];
  const reviewProgress = dueCards.length > 0 ? `${reviewIdx + 1} / ${dueCards.length}` : "0";

  return (
    <div>
      {/* Header actions */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-2 flex-1">
          <button onClick={() => { setMode("all"); setShowAdd(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "all" ? "bg-[hsl(0_0%_12%)] text-white" : "text-[hsl(0_0%_45%)] hover:text-white"}`}>
            <Layers className="w-4 h-4" /> All Cards <span className="text-[hsl(0_0%_35%)] font-normal">({allCards.length})</span>
          </button>
          <button onClick={() => { setMode("review"); setReviewIdx(0); setShowAdd(false); }}
            disabled={dueCards.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${mode === "review" ? "bg-[hsl(263_90%_60%/0.2)] text-[hsl(263_70%_75%)]" : "text-[hsl(0_0%_45%)] hover:text-white"}`}>
            <BrainCircuit className="w-4 h-4" /> Review
            {dueCards.length > 0 && <span className="bg-[hsl(263_90%_60%)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{dueCards.length}</span>}
          </button>
        </div>
        {!showAdd && mode === "all" && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-sm text-[hsl(0_0%_40%)] hover:text-white border border-dashed border-[hsl(0_0%_18%)] hover:border-[hsl(0_0%_30%)] rounded-lg px-4 py-2 transition-all">
            <Plus className="w-4 h-4" /> New Card
          </button>
        )}
      </div>

      {showAdd && <CardEditor onDone={() => setShowAdd(false)} />}

      {mode === "review" && (
        <div>
          {dueCards.length === 0 ? (
            <div className="text-center py-20 text-[hsl(0_0%_30%)]">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">All caught up! No cards due for review.</p>
            </div>
          ) : currentCard ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs text-[hsl(0_0%_30%)]">Progress: {reviewProgress}</p>
                <div className="flex-1 max-w-xs mx-4 bg-[hsl(0_0%_12%)] rounded-full h-1.5">
                  <div className="bg-[hsl(263_90%_60%)] h-1.5 rounded-full transition-all" style={{ width: `${(reviewIdx / dueCards.length) * 100}%` }} />
                </div>
                <button onClick={() => setMode("all")} className="text-xs text-[hsl(0_0%_35%)] hover:text-white">Exit</button>
              </div>
              <ReviewCard card={currentCard} onRate={handleRate} />
            </div>
          ) : null}
        </div>
      )}

      {mode === "all" && (
        <div>
          {allCards.length === 0 ? (
            <div className="text-center py-20 text-[hsl(0_0%_30%)]">
              <BrainCircuit className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No cards yet. Add one above or use Brain Dump.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allCards.map((card) => (
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
    <div className={`group relative bg-[hsl(0_0%_7%)] border rounded-xl p-4 hover:border-[hsl(0_0%_18%)] transition-all ${isDue ? "border-[hsl(263_60%_40%/0.4)]" : "border-[hsl(0_0%_12%)]"}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5 text-sm text-white outline-none resize-none font-mono" />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={2} className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-1.5 text-sm text-[hsl(0_0%_70%)] outline-none resize-none font-mono" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%)] text-white text-xs font-medium"><Check className="w-3 h-3" /> Save</button>
            <button onClick={() => { setFront(card.front); setBack(card.back); setEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-xs"><X className="w-3 h-3" /> Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 items-start pr-16">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white mb-1"><MathContent text={card.front} /></p>
            <p className="text-sm text-[hsl(0_0%_55%)]"><MathContent text={card.back} /></p>
          </div>
          <div className="text-right shrink-0">
            {isDue ? <span className="text-[10px] font-semibold text-[hsl(263_70%_70%)] uppercase tracking-wider">Due</span>
              : <span className="text-[10px] text-[hsl(0_0%_30%)]">{card.nextReview}</span>}
            <p className="text-[10px] text-[hsl(0_0%_25%)] mt-0.5">×{card.repetitions}</p>
          </div>
        </div>
      )}
      {!editing && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-md hover:bg-[hsl(0_0%_12%)] text-[hsl(0_0%_40%)] hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-red-900/40 text-[hsl(0_0%_40%)] hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}
