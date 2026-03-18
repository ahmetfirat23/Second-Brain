"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { differenceInDays, format, parseISO } from "date-fns";
import { AlertTriangle, Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CATEGORIES = ["Job", "Lecture", "Other"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_STYLES: Record<string, string> = {
  Job: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Lecture: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
  Other: "bg-[hsl(0_0%_15%)] text-[hsl(0_0%_65%)] border-[hsl(0_0%_22%)]",
};

function getDaysLeft(deadline: string) {
  try {
    const d = parseISO(deadline);
    if (isNaN(d.getTime())) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return differenceInDays(d, today);
  } catch { return 0; }
}

function UrgencyBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-xs font-semibold text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</span>;
  if (days === 0) return <span className="text-xs font-semibold text-red-400">Today</span>;
  if (days === 1) return <span className="text-xs font-semibold text-orange-400">Tomorrow</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-400">{days}d left</span>;
  return <span className="text-xs text-[hsl(0_0%_72%)]">{days}d left</span>;
}

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

type DeadlineItem = {
  _id: Id<"deadlines">;
  task: string;
  deadline: string;
  category: Category;
  sortOrder?: number;
  done?: boolean;
};

function SortableRow({
  item,
  onEdit,
  onRemove,
  onMarkDone,
  editingId,
  editTask,
  editDeadline,
  editCategory,
  setEditTask,
  setEditDeadline,
  setEditCategory,
  onSave,
  onCancelEdit,
}: {
  item: DeadlineItem;
  onEdit: () => void;
  onRemove: () => void;
  onMarkDone: () => void;
  editingId: Id<"deadlines"> | null;
  editTask: string;
  editDeadline: string;
  editCategory: Category;
  setEditTask: (v: string) => void;
  setEditDeadline: (v: string) => void;
  setEditCategory: (v: Category) => void;
  onSave: () => void;
  onCancelEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const days = getDaysLeft(item.deadline);
  const isUrgent = !item.done && days <= 7;
  const isEditing = editingId === item._id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 px-3 py-3 border-b border-[hsl(0_0%_11%)] last:border-0 transition-colors select-none ${
        item.done ? "opacity-50 hover:bg-[hsl(0_0%_11%)]" : isUrgent ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-[hsl(0_0%_11%)]"
      } ${isDragging ? "z-50 shadow-lg" : ""}`}
    >
      {/* Done checkbox */}
      <button
        onClick={onMarkDone}
        className="shrink-0 p-2.5 -m-2 touch-manipulation"
        aria-label={item.done ? "Mark undone" : "Mark done"}
      >
        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${item.done ? "bg-amber-600 border-amber-500 text-white" : "border-[hsl(0_0%_35%)] hover:border-amber-500 text-transparent"}`}>
          {item.done && <Check className="w-2.5 h-2.5" />}
        </span>
      </button>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-[hsl(0_0%_40%)] hover:text-[hsl(0_0%_60%)] select-none"
        style={{ touchAction: "none" }}
        tabIndex={-1}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {isEditing ? (
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <input
            autoFocus
            value={editTask}
            onChange={(e) => setEditTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
            className="flex-1 bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5 text-sm text-white outline-none"
          />
          <input
            type="date"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
            className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-1.5 text-sm text-white outline-none [color-scheme:dark]"
          />
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value as Category)}
            className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-1.5 text-sm text-white outline-none"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1 shrink-0">
            <button onClick={onSave} className="p-1.5 rounded-md bg-[hsl(263_90%_60%/0.2)] text-violet-400 hover:bg-[hsl(263_90%_60%/0.3)]"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={onCancelEdit} className="p-1.5 rounded-md hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_75%)]"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isUrgent && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />}
              <span className={`text-sm font-medium ${item.done ? "line-through text-[hsl(0_0%_55%)]" : isUrgent ? "text-red-200" : "text-white"}`}>{item.task}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[hsl(0_0%_70%)]">
                {(() => {
                  try {
                    const d = parseISO(item.deadline);
                    return isNaN(d.getTime()) ? item.deadline : format(d, "MMM d, yyyy");
                  } catch { return item.deadline; }
                })()}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Other}`}>
                {item.category}
              </span>
              <UrgencyBadge days={days} />
            </div>
          </div>
          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_75%)] hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-red-900/40 text-[hsl(0_0%_75%)] hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeadlineTable() {
  const items = useQuery(api.deadlines.list) ?? [];
  const createDeadline = useMutation(api.deadlines.create);
  const updateDeadline = useMutation(api.deadlines.update);
  const removeDeadline = useMutation(api.deadlines.remove);
  const reorderDeadlines = useMutation(api.deadlines.reorder);
  const markDone = useMutation(api.deadlines.markDone);

  const [editingId, setEditingId] = useState<Id<"deadlines"> | null>(null);
  const [editTask, setEditTask] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editCategory, setEditCategory] = useState<Category>("Other");
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Other");
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [filterUrgency, setFilterUrgency] = useState<"all" | "overdue" | "this_week" | "later">("all");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredItems = items
    .filter((item) => {
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      if (filterUrgency !== "all") {
        const days = getDaysLeft(item.deadline);
        if (filterUrgency === "overdue" && days >= 0) return false;
        if (filterUrgency === "this_week" && (days < 0 || days > 7)) return false;
        if (filterUrgency === "later" && days <= 7) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return 0;
    });

  function startEdit(item: DeadlineItem) {
    setEditingId(item._id);
    setEditTask(item.task);
    setEditDeadline(item.deadline);
    setEditCategory(item.category);
  }

  function saveEdit(id: Id<"deadlines">) {
    if (!isValidDate(editDeadline)) return;
    startTransition(async () => {
      await updateDeadline({ id, task: editTask, deadline: editDeadline, category: editCategory });
      setEditingId(null);
    });
  }

  function handleAdd() {
    if (!newTask.trim() || !isValidDate(newDeadline)) return;
    startTransition(async () => {
      await createDeadline({ task: newTask.trim(), deadline: newDeadline, category: newCategory });
      setNewTask(""); setNewDeadline(""); setShowAdd(false);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const allIds = items.map((i) => i._id);
    const oldIdx = allIds.indexOf(active.id as Id<"deadlines">);
    const newIdx = allIds.indexOf(over.id as Id<"deadlines">);
    const reordered = arrayMove(items, oldIdx, newIdx);
    reorderDeadlines({ orderedIds: reordered.map((i) => i._id) });
  }

  return (
    <div>
      {showAdd ? (
        <div className="mb-4 bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.3)] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">Add Deadline</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input autoFocus value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="Task name…"
              className="flex-1 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[hsl(0_0%_72%)] outline-none" />
            <input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white outline-none [color-scheme:dark]" />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as Category)}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white outline-none">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newTask.trim() || !isValidDate(newDeadline) || isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(263_90%_60%)] hover:bg-[hsl(263_90%_65%)] disabled:opacity-40 text-white text-sm font-medium">
              <Check className="w-3.5 h-3.5" /> Add
            </button>
            <button onClick={() => setShowAdd(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(0_0%_12%)] text-[hsl(0_0%_75%)] text-sm">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="mb-2 flex items-center gap-2 text-sm text-[hsl(0_0%_75%)] hover:text-white border border-dashed border-[hsl(0_0%_28%)] hover:border-[hsl(0_0%_30%)] rounded-xl px-4 py-2.5 w-full transition-all">
          <Plus className="w-4 h-4" /> Add Deadline
        </button>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 text-[hsl(0_0%_72%)]"><p className="text-sm">No deadlines yet. Add one above or use Brain Dump.</p></div>
      ) : (
        <>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-[hsl(0_0%_64%)]">Category</span>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as Category | "all")}
                className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]">
                <option value="all">All</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs text-[hsl(0_0%_64%)]">Urgency</span>
              <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value as typeof filterUrgency)}
                className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]">
                <option value="all">All</option>
                <option value="overdue">Overdue</option>
                <option value="this_week">This week</option>
                <option value="later">Later</option>
              </select>
            </div>
          )}
          <div className="rounded-xl border border-[hsl(0_0%_13%)] overflow-hidden">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredItems.map((i) => i._id)} strategy={verticalListSortingStrategy}>
                {filteredItems.map((item) => (
                  <SortableRow
                    key={item._id}
                    item={item as DeadlineItem}
                    onEdit={() => startEdit(item as DeadlineItem)}
                    onRemove={() => { if (confirm("Delete this deadline?")) removeDeadline({ id: item._id }); }}
                    onMarkDone={() => markDone({ id: item._id })}
                    editingId={editingId}
                    editTask={editTask}
                    editDeadline={editDeadline}
                    editCategory={editCategory}
                    setEditTask={setEditTask}
                    setEditDeadline={setEditDeadline}
                    setEditCategory={setEditCategory}
                    onSave={() => saveEdit(item._id)}
                    onCancelEdit={() => setEditingId(null)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </>
      )}
    </div>
  );
}
