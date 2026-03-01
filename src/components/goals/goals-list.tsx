"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays, parseISO } from "date-fns";
import {
  AlertTriangle, Check, ChevronDown, ChevronRight,
  GripVertical, MoreVertical, Pencil, Plus, Trash2, X,
} from "lucide-react";

const STATUS_SHORT = { not_started: "New", in_progress: "Active", done: "Done" } as const;
import { useState, useTransition } from "react";

type Goal = {
  _id: Id<"goals">;
  title: string;
  description?: string;
  importance: 1 | 2 | 3 | 4 | 5;
  size: "short" | "medium" | "long";
  status: "not_started" | "in_progress" | "done";
  startedAt?: string;
  doneAt?: string;
  sortOrder: number;
};

const SIZE_THRESHOLDS = { short: 5, medium: 10, long: 15 };
const SIZE_LABELS = { short: "S", medium: "M", long: "L" };
const SIZE_COLORS = {
  short: "bg-emerald-900/40 text-emerald-400 border-emerald-800/50",
  medium: "bg-amber-900/40 text-amber-400 border-amber-800/50",
  long: "bg-red-900/40 text-red-400 border-red-800/50",
};
const STATUS_STYLES = {
  not_started: "bg-zinc-800 text-zinc-400 border-zinc-700",
  in_progress: "bg-sky-900/40 text-sky-400 border-sky-800/50",
  done: "bg-emerald-900/40 text-emerald-400 border-emerald-800/50",
};
const STATUS_LABELS = { not_started: "Not started", in_progress: "In progress", done: "Done" };
const STATUS_NEXT: Record<Goal["status"], Goal["status"]> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

function overdueInfo(goal: Goal): { overdue: boolean; days: number } {
  if (goal.status !== "in_progress" || !goal.startedAt) return { overdue: false, days: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const started = parseISO(goal.startedAt);
  const days = differenceInDays(today, started);
  return { overdue: days > SIZE_THRESHOLDS[goal.size], days };
}

function ImportanceDots({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= value ? "bg-[hsl(263_70%_65%)]" : "bg-[hsl(0_0%_18%)]"}`} />
      ))}
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const setStatus = useMutation(api.goals.setStatus);
  const updateGoal = useMutation(api.goals.update);
  const removeGoal = useMutation(api.goals.remove);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: goal._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editDesc, setEditDesc] = useState(goal.description ?? "");
  const [editImportance, setEditImportance] = useState<Goal["importance"]>(goal.importance);
  const [editSize, setEditSize] = useState<Goal["size"]>(goal.size);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(!!goal.description);
  const [menuOpen, setMenuOpen] = useState(false);

  const { overdue, days } = overdueInfo(goal);

  function toggleExpanded() {
    if (goal.description) setExpanded((v) => !v);
  }

  function handleStatusCycle() {
    setStatus({ id: goal._id, status: STATUS_NEXT[goal.status] });
  }

  function handleSave() {
    startTransition(async () => {
      await updateGoal({ id: goal._id, title: editTitle, description: editDesc || undefined, importance: editImportance, size: editSize });
      setEditing(false);
    });
  }

  return (
    <div
      ref={setNodeRef} style={style}
      className={`group relative bg-[hsl(0_0%_10%)] border rounded-xl transition-all select-none ${
        overdue ? "border-red-800/60 shadow-[inset_3px_0_0_hsl(0_80%_40%/0.6)]" : "border-[hsl(0_0%_22%)] hover:border-[hsl(0_0%_17%)]"
      } ${isDragging ? "z-50 shadow-2xl" : ""}`}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 text-[hsl(0_0%_68%)] hover:text-[hsl(0_0%_70%)] cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}>
        <GripVertical className="w-4 h-4" />
      </div>

      {!editing ? (
        /* pr-8 reserves space for the absolutely-positioned action button so title never overlaps it */
        <div
          onClick={toggleExpanded}
          className={`relative pl-8 pr-8 py-2.5 sm:py-3 ${goal.description ? "cursor-pointer" : ""}`}
        >
          {/* Title — always full width */}
          <p className={`text-sm font-medium leading-snug ${goal.status === "done" ? "line-through text-[hsl(0_0%_68%)]" : "text-white"}`}>
            {goal.title}
          </p>

          {/* Expanded description */}
          {expanded && goal.description && (
            <p className="mt-1 text-xs text-[hsl(0_0%_72%)] leading-relaxed">{goal.description}</p>
          )}

          {/* Meta row — status + size + importance on one compact line */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <button
              onClick={(e) => { e.stopPropagation(); handleStatusCycle(); }}
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded border transition-colors ${STATUS_STYLES[goal.status]}`}
              title={STATUS_LABELS[goal.status]}
            >
              {STATUS_SHORT[goal.status]}
            </button>
            <span className={`text-[9px] font-medium uppercase px-1 py-0.5 rounded border ${SIZE_COLORS[goal.size]}`}>
              {SIZE_LABELS[goal.size]}
            </span>
            <ImportanceDots value={goal.importance} />
            {overdue && (
              <span className="flex items-center gap-0.5 text-[9px] font-medium text-red-400">
                <AlertTriangle className="w-2.5 h-2.5" />{days}d
              </span>
            )}
          </div>

          {/* Actions — absolutely positioned top-right, never takes layout space */}
          {/* Desktop: pencil + trash on hover */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-1 hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_68%)] hover:text-white">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => { if (confirm("Delete this goal?")) removeGoal({ id: goal._id }); }}
              className="p-1 rounded hover:bg-red-900/40 text-[hsl(0_0%_68%)] hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Mobile: single ⋮ button */}
          <div className="absolute top-2 right-1 lg:hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-1.5 rounded text-[hsl(0_0%_64%)] hover:text-white hover:bg-[hsl(0_0%_20%)]"
              aria-label="Actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-[hsl(0_0%_28%)] bg-[hsl(0_0%_13%)] py-1 shadow-xl">
                  <button
                    onClick={() => { setMenuOpen(false); setEditing(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[hsl(0_0%_85%)] hover:bg-[hsl(0_0%_20%)]"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); if (confirm("Delete this goal?")) removeGoal({ id: goal._id }); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="pl-8 pr-3 py-3 space-y-2">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus
            className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5 text-sm text-white outline-none" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
            placeholder="Description (optional)"
            className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-1.5 text-sm text-[hsl(0_0%_70%)] placeholder:text-[hsl(0_0%_72%)] outline-none resize-none" />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[hsl(0_0%_68%)]">Importance:</span>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={n} onClick={() => setEditImportance(n)}
                  className={`w-6 h-6 rounded text-xs font-medium transition-colors ${n === editImportance ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_72%)]"}`}>{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[hsl(0_0%_68%)]">Size:</span>
              {(["short", "medium", "long"] as const).map((s) => (
                <button key={s} onClick={() => setEditSize(s)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors capitalize ${s === editSize ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_72%)]"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!editTitle.trim() || isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%)] text-white text-xs font-medium disabled:opacity-40">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_68%)] text-xs">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddGoalForm({ onDone }: { onDone: () => void }) {
  const createGoal = useMutation(api.goals.create);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [importance, setImportance] = useState<Goal["importance"]>(3);
  const [size, setSize] = useState<Goal["size"]>("medium");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createGoal({ title: title.trim(), description: desc.trim() || undefined, importance, size });
      setTitle(""); setDesc(""); onDone();
    });
  }

  return (
    <div className="bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.3)] rounded-xl p-4 space-y-3 mb-4">
      <h3 className="text-sm font-medium text-white">New Goal</h3>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="What do you want to do? (be vague, be specific, whatever)"
        className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_58%)] outline-none focus:border-[hsl(263_90%_60%/0.5)]" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
        placeholder="More context (optional)"
        className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-[hsl(0_0%_70%)] placeholder:text-[hsl(0_0%_58%)] outline-none resize-none" />
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[hsl(0_0%_68%)]">Importance:</span>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button key={n} onClick={() => setImportance(n)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${n === importance ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_72%)] hover:bg-[hsl(0_0%_20%)]"}`}>{n}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[hsl(0_0%_68%)]">Size:</span>
          {(["short", "medium", "long"] as const).map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${s === size ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_72%)] hover:bg-[hsl(0_0%_20%)]"}`}>{s}</button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[hsl(0_0%_72%)]">
        Size sets overdue warning: short = 5d, medium = 10d, long = 15d after starting
      </p>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!title.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium">
          <Check className="w-3.5 h-3.5" /> Add Goal
        </button>
        <button onClick={onDone} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_68%)] text-sm">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

const FILTER_SIZE_OPTIONS = ["all", "short", "medium", "long"] as const;
const FILTER_IMPORTANCE_OPTIONS = ["all", 1, 2, 3, 4, 5] as const;
const FILTER_STATUS_OPTIONS = ["all", "not_started", "in_progress"] as const;

export function GoalsList() {
  const allGoals = useQuery(api.goals.list) ?? [];
  const reorderGoals = useMutation(api.goals.reorder);
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [filterSize, setFilterSize] = useState<typeof FILTER_SIZE_OPTIONS[number]>("all");
  const [filterImportance, setFilterImportance] = useState<typeof FILTER_IMPORTANCE_OPTIONS[number]>("all");
  const [filterStatus, setFilterStatus] = useState<typeof FILTER_STATUS_OPTIONS[number]>("all");

  const activeGoalsRaw = allGoals.filter((g) => g.status !== "done");
  const activeGoals = activeGoalsRaw.filter((g) => {
    if (filterSize !== "all" && g.size !== filterSize) return false;
    if (filterImportance !== "all" && g.importance !== filterImportance) return false;
    if (filterStatus !== "all" && g.status !== filterStatus) return false;
    return true;
  });
  const doneGoals = allGoals.filter((g) => g.status === "done");
  const overdueCount = activeGoals.filter((g) => overdueInfo(g as Goal).overdue).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = activeGoals.findIndex((g) => g._id === active.id);
    const newIdx = activeGoals.findIndex((g) => g._id === over.id);
    const reorderedFiltered = arrayMove(activeGoals, oldIdx, newIdx);
    const filteredSet = new Set(activeGoals.map((g) => g._id));
    let rfIdx = 0;
    const newOrdered = activeGoalsRaw.map((g) =>
      filteredSet.has(g._id) ? reorderedFiltered[rfIdx++]! : g
    );
    reorderGoals({ orderedIds: newOrdered.map((g) => g._id) });
  }

  return (
    <div>
      {/* Filters */}
      {activeGoalsRaw.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-[hsl(0_0%_64%)]">Size</span>
          <select
            value={filterSize}
            onChange={(e) => setFilterSize(e.target.value as typeof filterSize)}
            className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
          >
            {FILTER_SIZE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o === "all" ? "All" : SIZE_LABELS[o as Goal["size"]]}</option>
            ))}
          </select>
          <span className="text-xs text-[hsl(0_0%_64%)]">Importance</span>
          <select
            value={filterImportance}
            onChange={(e) => setFilterImportance(e.target.value === "all" ? "all" : Number(e.target.value) as typeof filterImportance)}
            className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
          >
            {FILTER_IMPORTANCE_OPTIONS.map((o) => (
              <option key={o} value={o}>{o === "all" ? "All" : o}</option>
            ))}
          </select>
          <span className="text-xs text-[hsl(0_0%_64%)]">Status</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
          >
            {FILTER_STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>{o === "all" ? "All" : STATUS_LABELS[o as Goal["status"]]}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats bar */}
      {activeGoals.length > 0 && (
        <div className="flex items-center gap-4 mb-5 text-xs text-[hsl(0_0%_68%)]">
          <span>{activeGoals.filter((g) => g.status === "in_progress").length} in progress</span>
          <span>{activeGoals.filter((g) => g.status === "not_started").length} not started</span>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-400 font-medium">
              <AlertTriangle className="w-3 h-3" /> {overdueCount} overdue
            </span>
          )}
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="mb-4 flex items-center gap-2 text-sm text-[hsl(0_0%_68%)] hover:text-white border border-dashed border-[hsl(0_0%_28%)] hover:border-[hsl(0_0%_30%)] rounded-xl px-4 py-3 w-full transition-all">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      ) : (
        <AddGoalForm onDone={() => setShowAdd(false)} />
      )}

      {activeGoals.length === 0 && !showAdd ? (
        <div className="text-center py-20 text-[hsl(0_0%_72%)]">
          <p className="text-sm">No goals yet. Add something you want to do — big or small.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activeGoals.map((g) => g._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {activeGoals.map((g) => <GoalCard key={g._id} goal={g as Goal} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Done section */}
      {doneGoals.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[hsl(0_0%_72%)] uppercase tracking-wider hover:text-[hsl(0_0%_72%)] transition-colors mb-3"
          >
            {showDone ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Done ({doneGoals.length})
          </button>
          {showDone && (
            <div className="space-y-2 opacity-60">
              {doneGoals.map((g) => <GoalCard key={g._id} goal={g as Goal} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
