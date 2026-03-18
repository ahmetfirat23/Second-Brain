"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  ArrowRight, Check, ChevronDown, ChevronRight,
  GripVertical, ListTodo, Plus, Trash2, Undo2,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const URGENCY_OPTIONS = [
  { value: 1, label: "1", color: "bg-zinc-700/50 text-zinc-400" },
  { value: 2, label: "2", color: "bg-slate-700/50 text-slate-400" },
  { value: 3, label: "3", color: "bg-amber-900/40 text-amber-400" },
  { value: 4, label: "4", color: "bg-orange-900/40 text-orange-400" },
  { value: 5, label: "5", color: "bg-red-900/40 text-red-400" },
] as const;

type Item = { _id: Id<"weeklyTodos">; text: string; urgency: number; done: boolean; sortOrder: number; scheduledDate?: string };

export default function DailyTodosPage() {
  const [today, setToday] = useState("");
  useEffect(() => { setToday(format(new Date(), "yyyy-MM-dd")); }, []);

  // Single source of truth — all items live in weeklyTodos
  const allItems = useQuery(api.weeklyTodos.list) ?? [];
  const createItem = useMutation(api.weeklyTodos.create);
  const toggleDone = useMutation(api.weeklyTodos.toggleDone);
  const updateItem = useMutation(api.weeklyTodos.update);
  const removeItem = useMutation(api.weeklyTodos.remove);
  const reorderItems = useMutation(api.weeklyTodos.reorder);
  const scheduleForDate = useMutation(api.weeklyTodos.scheduleForDate);
  const unschedule = useMutation(api.weeklyTodos.unschedule);

  const [newText, setNewText] = useState("");
  const [newUrgency, setNewUrgency] = useState(3);
  const [newPoolText, setNewPoolText] = useState("");
  const [newPoolUrgency, setNewPoolUrgency] = useState(3);
  const [filterUrgency, setFilterUrgency] = useState<number | "all">("all");
  const [poolOpen, setPoolOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isPoolPending, startPoolTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Daily = scheduled for today
  const dailyItems = today ? allItems.filter((i) => i.scheduledDate === today) : [];
  const sortedDaily = [...dailyItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const filteredDaily = filterUrgency === "all" ? sortedDaily : sortedDaily.filter((i) => i.urgency === filterUrgency);
  const pendingDaily = filteredDaily.filter((i) => !i.done);
  const doneDaily = filteredDaily.filter((i) => i.done);

  // Pool = everything not scheduled for today
  const poolItems = today ? allItems.filter((i) => i.scheduledDate !== today) : allItems;
  const sortedPool = [...poolItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const filteredPool = filterUrgency === "all" ? sortedPool : sortedPool.filter((i) => i.urgency === filterUrgency);
  const pendingPool = filteredPool.filter((i) => !i.done);
  const donePool = filteredPool.filter((i) => i.done);

  const hasAnyDaily = dailyItems.length > 0;

  function handleAddToday() {
    if (!newText.trim()) return;
    startTransition(async () => {
      await createItem({ text: newText.trim(), urgency: newUrgency, scheduledDate: today });
      setNewText("");
    });
  }

  function handleAddPool() {
    if (!newPoolText.trim()) return;
    startPoolTransition(async () => {
      await createItem({ text: newPoolText.trim(), urgency: newPoolUrgency });
      setNewPoolText("");
    });
  }

  function handleDailyDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pendingDaily.map((i) => i._id);
    const reordered = arrayMove(pendingDaily, ids.indexOf(active.id as Id<"weeklyTodos">), ids.indexOf(over.id as Id<"weeklyTodos">));
    reorderItems({ orderedIds: reordered.map((i) => i._id) });
  }

  function handlePoolDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pendingPool.map((i) => i._id);
    const reordered = arrayMove(pendingPool, ids.indexOf(active.id as Id<"weeklyTodos">), ids.indexOf(over.id as Id<"weeklyTodos">));
    reorderItems({ orderedIds: reordered.map((i) => i._id) });
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-2 sm:py-8 pb-8">
      {/* Header */}
      <div className="mb-2 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-teal-900/30 flex items-center justify-center shrink-0">
            <ListTodo className="w-3 h-3 sm:w-4 sm:h-4 text-teal-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold text-white truncate">Daily Todos</h1>
            <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] truncate">
              {today ? format(new Date(today + "T12:00:00"), "EEE, MMM d") : ""} — midnight reset
            </p>
          </div>
        </div>
        {hasAnyDaily && (
          <div className="flex items-center gap-2 mt-2 ml-8 sm:ml-11 flex-wrap">
            <span className="text-xs text-[hsl(0_0%_64%)]">Filter by urgency:</span>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
            >
              <option value="all">All</option>
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2 sm:space-y-4">
        {/* Add to today */}
        <div className="flex flex-row gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddToday()}
            placeholder="What will you do today?"
            className="flex-1 min-w-0 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[hsl(0_0%_64%)] outline-none focus:border-teal-600/50"
          />
          <div className="flex gap-2">
            <select
              value={newUrgency}
              onChange={(e) => setNewUrgency(Number(e.target.value))}
              className="w-12 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-1.5 py-2.5 text-sm text-white outline-none [color-scheme:dark]"
              title="Urgency 1-5"
            >
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value}</option>
              ))}
            </select>
            <button
              onClick={handleAddToday}
              disabled={!newText.trim() || isPending}
              className="p-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white transition-colors flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Daily card */}
        {!hasAnyDaily ? (
          <div className="rounded-xl border border-dashed border-[hsl(0_0%_28%)] py-5 sm:py-16 text-center">
            <p className="text-sm text-[hsl(0_0%_68%)] px-4">No items for today. Add something above or pick from the pool below.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden">
            {/* Pending (draggable) */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDailyDragEnd}>
              <SortableContext items={pendingDaily.map((i) => i._id)} strategy={verticalListSortingStrategy}>
                {pendingDaily.map((item) => (
                  <SortableDailyRow
                    key={item._id}
                    item={item}
                    onToggle={() => toggleDone({ id: item._id })}
                    onUpdate={(text, urgency) => updateItem({ id: item._id, text, urgency })}
                    onUnschedule={() => unschedule({ id: item._id })}
                    urgencyOptions={URGENCY_OPTIONS}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Done */}
            {doneDaily.length > 0 && (
              <>
                <div className="h-px bg-[hsl(0_0%_12%)]" />
                {doneDaily.map((item) => (
                  <DailyRow
                    key={item._id}
                    item={item}
                    done
                    onToggle={() => toggleDone({ id: item._id })}
                    onUpdate={(text, urgency) => updateItem({ id: item._id, text, urgency })}
                    onUnschedule={() => unschedule({ id: item._id })}
                    urgencyOptions={URGENCY_OPTIONS}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Pool section */}
        <div className="pt-2 sm:pt-6">
          <button
            onClick={() => setPoolOpen((v) => !v)}
            className="w-full flex items-center gap-2 sm:gap-3 text-left mb-3 group"
          >
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-purple-900/30 flex items-center justify-center shrink-0">
              {poolOpen
                ? <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                : <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />}
            </div>
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="text-base sm:text-xl font-semibold text-white">Pool</span>
              {!poolOpen && poolItems.length > 0 && (
                <span className="text-xs text-[hsl(0_0%_50%)]">
                  {poolItems.filter((i) => !i.done).length} pending
                </span>
              )}
            </div>
          </button>

          {poolOpen && (
            <div className="space-y-2 sm:space-y-4">
              {/* Add pool task */}
              <div className="flex flex-row gap-2">
                <input
                  value={newPoolText}
                  onChange={(e) => setNewPoolText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPool()}
                  placeholder="Add to pool..."
                  className="flex-1 min-w-0 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[hsl(0_0%_64%)] outline-none focus:border-purple-600/50"
                />
                <div className="flex gap-2">
                  <select
                    value={newPoolUrgency}
                    onChange={(e) => setNewPoolUrgency(Number(e.target.value))}
                    className="w-12 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-1.5 py-2.5 text-sm text-white outline-none [color-scheme:dark]"
                    title="Urgency 1-5"
                  >
                    {URGENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.value}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddPool}
                    disabled={!newPoolText.trim() || isPoolPending}
                    className="p-2.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {poolItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[hsl(0_0%_28%)] py-5 text-center">
                  <p className="text-sm text-[hsl(0_0%_68%)] px-4">Pool is empty. Add tasks to plan ahead.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePoolDragEnd}>
                    <SortableContext items={pendingPool.map((i) => i._id)} strategy={verticalListSortingStrategy}>
                      {pendingPool.map((item) => (
                        <SortablePoolRow
                          key={item._id}
                          item={item}
                          onToggle={() => toggleDone({ id: item._id })}
                          onUpdate={(text, urgency) => updateItem({ id: item._id, text, urgency })}
                          onRemove={() => removeItem({ id: item._id })}
                          onSchedule={() => scheduleForDate({ id: item._id, date: today })}
                          urgencyOptions={URGENCY_OPTIONS}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {donePool.length > 0 && (
                    <>
                      <div className="h-px bg-[hsl(0_0%_12%)]" />
                      {donePool.map((item) => (
                        <PoolRow
                          key={item._id}
                          item={item}
                          done
                          onToggle={() => toggleDone({ id: item._id })}
                          onUpdate={(text, urgency) => updateItem({ id: item._id, text, urgency })}
                          onRemove={() => removeItem({ id: item._id })}
                          onSchedule={() => scheduleForDate({ id: item._id, date: today })}
                          urgencyOptions={URGENCY_OPTIONS}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Daily card rows (scheduled for today) ────────────────────────────────────

function SortableDailyRow(props: {
  item: Item;
  onToggle: () => void;
  onUpdate: (text: string, urgency: number) => void;
  onUnschedule: () => void;
  urgencyOptions: typeof URGENCY_OPTIONS;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.item._id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={isDragging ? "z-50 shadow-lg" : ""}
    >
      <DailyRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function DailyRow({
  item, done, onToggle, onUpdate, onUnschedule, urgencyOptions, dragHandleProps,
}: {
  item: Item;
  done?: boolean;
  onToggle: () => void;
  onUpdate: (text: string, urgency: number) => void;
  onUnschedule: () => void;
  urgencyOptions: typeof URGENCY_OPTIONS;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editUrgency, setEditUrgency] = useState(item.urgency);
  const [isPending, startTransition] = useTransition();

  const urgencyStyle = urgencyOptions.find((o) => o.value === item.urgency)?.color ?? "bg-zinc-700/50 text-zinc-400";

  function handleSave() {
    if (editText.trim() !== item.text || editUrgency !== item.urgency) {
      startTransition(async () => {
        await onUpdate(editText.trim(), editUrgency);
        setEditing(false);
      });
    } else {
      setEditing(false);
    }
  }

  return (
    <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 sm:py-3 border-b border-[hsl(0_0%_10%)] last:border-0 group hover:bg-[hsl(0_0%_13%)] active:bg-[hsl(0_0%_13%)] transition-colors min-h-[52px] select-none ${done ? "opacity-60" : ""}`}>
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          className="shrink-0 cursor-grab active:cursor-grabbing text-[hsl(0_0%_35%)] hover:text-[hsl(0_0%_55%)] select-none"
          style={{ touchAction: "none" }}
          tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={onToggle}
        className="shrink-0 p-2.5 -m-1.5 flex items-center justify-center touch-manipulation"
        aria-label={done ? "Mark undone" : "Mark done"}
      >
        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${done ? "bg-teal-600 border-teal-500 text-white" : "border-[hsl(0_0%_35%)] hover:border-teal-500 active:border-teal-500 text-transparent"}`}>
          {done && <Check className="w-3 h-3" />}
        </span>
      </button>

      {editing ? (
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 min-w-0 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2.5 text-base sm:text-sm text-white outline-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={editUrgency}
              onChange={(e) => setEditUrgency(Number(e.target.value))}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
            >
              {urgencyOptions.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-teal-400 hover:text-teal-300 bg-teal-900/20 touch-manipulation"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <span
            onClick={() => setEditing(true)}
            className={`flex-1 min-w-0 text-sm cursor-pointer py-1 break-words ${done ? "line-through text-[hsl(0_0%_72%)]" : "text-white"}`}
          >
            {item.text}
          </span>
          <span className={`shrink-0 text-[10px] px-2 py-1 rounded ${urgencyStyle}`} title="Urgency">
            {item.urgency}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUnschedule(); }}
            title="Return to pool"
            className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1 rounded flex items-center justify-center text-[hsl(0_0%_68%)] hover:text-purple-400 active:text-purple-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
          >
            <Undo2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Pool rows ────────────────────────────────────────────────────────────────

function SortablePoolRow(props: {
  item: Item;
  onToggle: () => void;
  onUpdate: (text: string, urgency: number) => void;
  onRemove: () => void;
  onSchedule: () => void;
  urgencyOptions: typeof URGENCY_OPTIONS;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.item._id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={isDragging ? "z-50 shadow-lg" : ""}
    >
      <PoolRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function PoolRow({
  item, done, onToggle, onUpdate, onRemove, onSchedule, urgencyOptions, dragHandleProps,
}: {
  item: Item;
  done?: boolean;
  onToggle: () => void;
  onUpdate: (text: string, urgency: number) => void;
  onRemove: () => void;
  onSchedule: () => void;
  urgencyOptions: typeof URGENCY_OPTIONS;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editUrgency, setEditUrgency] = useState(item.urgency);
  const [isPending, startTransition] = useTransition();

  const urgencyStyle = urgencyOptions.find((o) => o.value === item.urgency)?.color ?? "bg-zinc-700/50 text-zinc-400";

  function handleSave() {
    if (editText.trim() !== item.text || editUrgency !== item.urgency) {
      startTransition(async () => {
        await onUpdate(editText.trim(), editUrgency);
        setEditing(false);
      });
    } else {
      setEditing(false);
    }
  }

  return (
    <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 sm:py-3 border-b border-[hsl(0_0%_10%)] last:border-0 group hover:bg-[hsl(0_0%_13%)] active:bg-[hsl(0_0%_13%)] transition-colors min-h-[52px] select-none ${done ? "opacity-60" : ""}`}>
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          className="shrink-0 cursor-grab active:cursor-grabbing text-[hsl(0_0%_35%)] hover:text-[hsl(0_0%_55%)] select-none"
          style={{ touchAction: "none" }}
          tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={onToggle}
        className="shrink-0 p-2.5 -m-1.5 flex items-center justify-center touch-manipulation"
        aria-label={done ? "Mark undone" : "Mark done"}
      >
        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${done ? "bg-purple-600 border-purple-500 text-white" : "border-[hsl(0_0%_35%)] hover:border-purple-500 active:border-purple-500 text-transparent"}`}>
          {done && <Check className="w-3 h-3" />}
        </span>
      </button>

      {editing ? (
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 min-w-0 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2.5 text-base sm:text-sm text-white outline-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={editUrgency}
              onChange={(e) => setEditUrgency(Number(e.target.value))}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
            >
              {urgencyOptions.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-purple-400 hover:text-purple-300 bg-purple-900/20 touch-manipulation"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <span
            onClick={() => setEditing(true)}
            className={`flex-1 min-w-0 text-sm cursor-pointer py-1 break-words ${done ? "line-through text-[hsl(0_0%_72%)]" : "text-white"}`}
          >
            {item.text}
          </span>
          <span className={`shrink-0 text-[10px] px-2 py-1 rounded ${urgencyStyle}`} title="Urgency">
            {item.urgency}
          </span>
          {!done && (
            <button
              onClick={(e) => { e.stopPropagation(); onSchedule(); }}
              title="Do today"
              className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1 rounded flex items-center justify-center text-[hsl(0_0%_68%)] hover:text-purple-400 active:text-purple-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
            >
              <ArrowRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Delete"
            className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1 rounded flex items-center justify-center text-[hsl(0_0%_68%)] hover:text-red-400 active:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
