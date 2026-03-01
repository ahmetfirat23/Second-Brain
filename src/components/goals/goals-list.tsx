"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor,
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
  GripVertical, Pencil, Plus, Trash2, X,
} from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);

  const { overdue, days } = overdueInfo(goal);

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
      className={`group relative bg-[hsl(0_0%_7%)] border rounded-xl transition-all ${
        overdue ? "border-red-800/60 shadow-[inset_3px_0_0_hsl(0_80%_40%/0.6)]" : "border-[hsl(0_0%_12%)] hover:border-[hsl(0_0%_17%)]"
      } ${isDragging ? "z-50 shadow-2xl" : ""}`}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-[hsl(0_0%_22%)] hover:text-[hsl(0_0%_40%)] cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </div>

      {!editing ? (
        <div className="pl-8 pr-3 py-3">
          <div className="flex items-start gap-3">
            {/* Status button */}
            <button onClick={handleStatusCycle}
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-colors mt-0.5 ${STATUS_STYLES[goal.status]}`}>
              {STATUS_LABELS[goal.status]}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <button onClick={() => setExpanded((v) => !v)} className="text-left w-full">
                <p className={`text-sm font-medium leading-snug ${goal.status === "done" ? "line-through text-[hsl(0_0%_40%)]" : "text-white"}`}>
                  {goal.title}
                </p>
              </button>
              {expanded && goal.description && (
                <p className="mt-1 text-xs text-[hsl(0_0%_50%)] leading-relaxed">{goal.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <ImportanceDots value={goal.importance} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${SIZE_COLORS[goal.size]}`}>
                  {SIZE_LABELS[goal.size]}
                </span>
                {overdue && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    {days}d overdue
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-md hover:bg-[hsl(0_0%_12%)] text-[hsl(0_0%_40%)] hover:text-white">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (confirm("Delete this goal?")) removeGoal({ id: goal._id }); }}
                className="p-1.5 rounded-md hover:bg-red-900/40 text-[hsl(0_0%_40%)] hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pl-8 pr-3 py-3 space-y-2">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus
            className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5 text-sm text-white outline-none" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
            placeholder="Description (optional)"
            className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-1.5 text-sm text-[hsl(0_0%_70%)] placeholder:text-[hsl(0_0%_30%)] outline-none resize-none" />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[hsl(0_0%_40%)]">Importance:</span>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={n} onClick={() => setEditImportance(n)}
                  className={`w-6 h-6 rounded text-xs font-medium transition-colors ${n === editImportance ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_50%)]"}`}>{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[hsl(0_0%_40%)]">Size:</span>
              {(["short", "medium", "long"] as const).map((s) => (
                <button key={s} onClick={() => setEditSize(s)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors capitalize ${s === editSize ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_50%)]"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!editTitle.trim() || isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(263_90%_60%)] text-white text-xs font-medium disabled:opacity-40">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-xs">
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
    <div className="bg-[hsl(0_0%_7%)] border border-[hsl(263_90%_60%/0.3)] rounded-xl p-4 space-y-3 mb-4">
      <h3 className="text-sm font-medium text-white">New Goal</h3>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="What do you want to do? (be vague, be specific, whatever)"
        className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_28%)] outline-none focus:border-[hsl(263_90%_60%/0.5)]" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
        placeholder="More context (optional)"
        className="w-full bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] rounded-lg px-3 py-2 text-sm text-[hsl(0_0%_70%)] placeholder:text-[hsl(0_0%_28%)] outline-none resize-none" />
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[hsl(0_0%_40%)]">Importance:</span>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button key={n} onClick={() => setImportance(n)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${n === importance ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_50%)] hover:bg-[hsl(0_0%_16%)]"}`}>{n}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[hsl(0_0%_40%)]">Size:</span>
          {(["short", "medium", "long"] as const).map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${s === size ? "bg-[hsl(263_90%_60%)] text-white" : "bg-[hsl(0_0%_12%)] text-[hsl(0_0%_50%)] hover:bg-[hsl(0_0%_16%)]"}`}>{s}</button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[hsl(0_0%_30%)]">
        Size sets overdue warning: short = 5d, medium = 10d, long = 15d after starting
      </p>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!title.trim() || isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium">
          <Check className="w-3.5 h-3.5" /> Add Goal
        </button>
        <button onClick={onDone} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_60%)] text-sm">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

export function GoalsList() {
  const allGoals = useQuery(api.goals.list) ?? [];
  const reorderGoals = useMutation(api.goals.reorder);
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const activeGoals = allGoals.filter((g) => g.status !== "done");
  const doneGoals = allGoals.filter((g) => g.status === "done");
  const overdueCount = activeGoals.filter((g) => overdueInfo(g as Goal).overdue).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = activeGoals.findIndex((g) => g._id === active.id);
    const newIdx = activeGoals.findIndex((g) => g._id === over.id);
    const reordered = arrayMove(activeGoals, oldIdx, newIdx);
    reorderGoals({ orderedIds: reordered.map((g) => g._id) });
  }

  return (
    <div>
      {/* Stats bar */}
      {activeGoals.length > 0 && (
        <div className="flex items-center gap-4 mb-5 text-xs text-[hsl(0_0%_40%)]">
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
          className="mb-4 flex items-center gap-2 text-sm text-[hsl(0_0%_40%)] hover:text-white border border-dashed border-[hsl(0_0%_18%)] hover:border-[hsl(0_0%_30%)] rounded-xl px-4 py-3 w-full transition-all">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      ) : (
        <AddGoalForm onDone={() => setShowAdd(false)} />
      )}

      {activeGoals.length === 0 && !showAdd ? (
        <div className="text-center py-20 text-[hsl(0_0%_30%)]">
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
            className="flex items-center gap-2 text-xs font-medium text-[hsl(0_0%_30%)] uppercase tracking-wider hover:text-[hsl(0_0%_50%)] transition-colors mb-3"
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
