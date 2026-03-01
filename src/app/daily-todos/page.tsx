"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { Check, ListTodo, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

const URGENCY_OPTIONS = [
  { value: 1, label: "1", color: "bg-zinc-700/50 text-zinc-400" },
  { value: 2, label: "2", color: "bg-slate-700/50 text-slate-400" },
  { value: 3, label: "3", color: "bg-amber-900/40 text-amber-400" },
  { value: 4, label: "4", color: "bg-orange-900/40 text-orange-400" },
  { value: 5, label: "5", color: "bg-red-900/40 text-red-400" },
] as const;

function getToday() {
  return format(new Date(), "yyyy-MM-dd");
}

export default function DailyTodosPage() {
  const today = getToday();
  const items = useQuery(api.dailyTodos.listForDate, { date: today }) ?? [];
  const createTodo = useMutation(api.dailyTodos.create);
  const toggleDone = useMutation(api.dailyTodos.toggleDone);
  const updateTodo = useMutation(api.dailyTodos.update);
  const removeTodo = useMutation(api.dailyTodos.remove);

  const [newText, setNewText] = useState("");
  const [newUrgency, setNewUrgency] = useState(3);
  const [filterUrgency, setFilterUrgency] = useState<number | "all">("all");
  const [isPending, startTransition] = useTransition();

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const filtered = filterUrgency === "all" ? sorted : sorted.filter((i) => i.urgency === filterUrgency);
  const pending = filtered.filter((i) => !i.done);
  const done = filtered.filter((i) => i.done);

  function handleAdd() {
    if (!newText.trim()) return;
    startTransition(async () => {
      await createTodo({ date: today, text: newText.trim(), urgency: newUrgency });
      setNewText("");
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-teal-900/30 flex items-center justify-center shrink-0">
            <ListTodo className="w-3 h-3 sm:w-4 sm:h-4 text-teal-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold text-white truncate">Daily Todos</h1>
            <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] truncate">
              {format(new Date(), "EEE, MMM d")} — midnight reset
            </p>
          </div>
        </div>
        {sorted.length > 0 && (
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

      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="What will you do today?"
            className="flex-1 min-w-0 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-4 py-3 sm:py-2.5 text-base sm:text-sm text-white placeholder:text-[hsl(0_0%_64%)] outline-none focus:border-teal-600/50"
          />
          <div className="flex gap-2">
            <select
              value={newUrgency}
              onChange={(e) => setNewUrgency(Number(e.target.value))}
              className="w-20 sm:w-14 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-3 sm:py-2.5 text-sm text-white outline-none [color-scheme:dark]"
              title="Urgency 1-5"
            >
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newText.trim() || isPending}
              className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-3 sm:p-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white transition-colors flex items-center justify-center"
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[hsl(0_0%_28%)] py-12 sm:py-16 text-center">
            <p className="text-sm text-[hsl(0_0%_68%)] px-4">No items for today. Add something above.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[hsl(0_0%_34%)] bg-[hsl(0_0%_11%)] overflow-hidden">
            {pending.map((item) => (
              <TodoRow
                key={item._id}
                item={item}
                onToggle={() => toggleDone({ id: item._id })}
                onUpdate={(text, urgency) => updateTodo({ id: item._id, text, urgency })}
                onRemove={() => removeTodo({ id: item._id })}
                urgencyOptions={URGENCY_OPTIONS}
              />
            ))}
            {done.length > 0 && (
              <>
                <div className="h-px bg-[hsl(0_0%_12%)]" />
                {done.map((item) => (
                  <TodoRow
                    key={item._id}
                    item={item}
                    done
                    onToggle={() => toggleDone({ id: item._id })}
                    onUpdate={(text, urgency) => updateTodo({ id: item._id, text, urgency })}
                    onRemove={() => removeTodo({ id: item._id })}
                    urgencyOptions={URGENCY_OPTIONS}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TodoRow({
  item,
  done,
  onToggle,
  onUpdate,
  onRemove,
  urgencyOptions,
}: {
  item: { _id: Id<"dailyTodos">; text: string; urgency: number };
  done?: boolean;
  onToggle: () => void;
  onUpdate: (text: string, urgency: number) => void;
  onRemove: () => void;
  urgencyOptions: typeof URGENCY_OPTIONS;
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
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3.5 sm:py-3 border-b border-[hsl(0_0%_10%)] last:border-0 group hover:bg-[hsl(0_0%_13%)] active:bg-[hsl(0_0%_13%)] transition-colors min-h-[52px] ${
        done ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className={`shrink-0 w-11 h-11 sm:w-5 sm:h-5 rounded border flex items-center justify-center transition-colors touch-manipulation ${
          done
            ? "bg-teal-600 border-teal-500 text-white"
            : "border-[hsl(0_0%_30%)] hover:border-teal-500/50 active:border-teal-500/50 text-transparent hover:text-teal-400"
        }`}
      >
        {done && <Check className="w-4 h-4 sm:w-3 sm:h-3" />}
      </button>

      {editing ? (
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-2 sm:gap-2 sm:items-center">
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 min-w-0 bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2.5 text-base sm:text-sm text-white outline-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={editUrgency}
              onChange={(e) => setEditUrgency(Number(e.target.value))}
              className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
            >
              {urgencyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
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
            className={`flex-1 min-w-0 text-sm sm:text-sm cursor-pointer py-1 break-words ${done ? "line-through text-[hsl(0_0%_72%)]" : "text-white"}`}
          >
            {item.text}
          </span>
          <span
            className={`shrink-0 text-[10px] px-2 py-1 rounded ${urgencyStyle}`}
            title="Urgency"
          >
            {item.urgency}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1 rounded flex items-center justify-center text-[hsl(0_0%_68%)] hover:text-red-400 active:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
