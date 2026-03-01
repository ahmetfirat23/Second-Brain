"use client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { differenceInDays, format, parseISO } from "date-fns";
import { AlertTriangle, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

const CATEGORIES = ["Job", "Lecture", "Other"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_STYLES: Record<string, string> = {
  Job: "bg-sky-900/40 text-sky-400 border-sky-800/50",
  Lecture: "bg-amber-900/40 text-amber-400 border-amber-800/50",
  Other: "bg-zinc-800/40 text-zinc-400 border-zinc-700/50",
};

function getDaysLeft(deadline: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return differenceInDays(parseISO(deadline), today);
}

function UrgencyBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-xs font-semibold text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</span>;
  if (days === 0) return <span className="text-xs font-semibold text-red-400">Today</span>;
  if (days === 1) return <span className="text-xs font-semibold text-orange-400">Tomorrow</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-400">{days}d left</span>;
  return <span className="text-xs text-[hsl(0_0%_72%)]">{days}d left</span>;
}

export function DeadlineTable() {
  const items = useQuery(api.deadlines.list) ?? [];
  const createDeadline = useMutation(api.deadlines.create);
  const updateDeadline = useMutation(api.deadlines.update);
  const removeDeadline = useMutation(api.deadlines.remove);

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

  const filteredItems = items.filter((item) => {
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (filterUrgency !== "all") {
      const days = getDaysLeft(item.deadline);
      if (filterUrgency === "overdue" && days >= 0) return false;
      if (filterUrgency === "this_week" && (days < 0 || days > 7)) return false;
      if (filterUrgency === "later" && days <= 7) return false;
    }
    return true;
  });

  function startEdit(id: Id<"deadlines">, task: string, deadline: string, category: Category) {
    setEditingId(id); setEditTask(task); setEditDeadline(deadline); setEditCategory(category);
  }

  function saveEdit(id: Id<"deadlines">) {
    startTransition(async () => {
      await updateDeadline({ id, task: editTask, deadline: editDeadline, category: editCategory });
      setEditingId(null);
    });
  }

  function handleAdd() {
    if (!newTask.trim() || !newDeadline) return;
    startTransition(async () => {
      await createDeadline({ task: newTask.trim(), deadline: newDeadline, category: newCategory });
      setNewTask(""); setNewDeadline(""); setShowAdd(false);
    });
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
            <button onClick={handleAdd} disabled={!newTask.trim() || !newDeadline || isPending}
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
          className="mb-4 flex items-center gap-2 text-sm text-[hsl(0_0%_75%)] hover:text-white border border-dashed border-[hsl(0_0%_28%)] hover:border-[hsl(0_0%_30%)] rounded-xl px-4 py-3 w-full transition-all">
          <Plus className="w-4 h-4" /> Add Deadline
        </button>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20 text-[hsl(0_0%_72%)]"><p className="text-sm">No deadlines yet. Add one above or use Brain Dump.</p></div>
      ) : (
        <>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-[hsl(0_0%_64%)]">Category</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as Category | "all")}
                className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
              >
                <option value="all">All</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs text-[hsl(0_0%_64%)]">Urgency</span>
              <select
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value as typeof filterUrgency)}
                className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
              >
                <option value="all">All</option>
                <option value="overdue">Overdue</option>
                <option value="this_week">This week</option>
                <option value="later">Later</option>
              </select>
            </div>
          )}
        <div className="rounded-xl border border-[hsl(0_0%_13%)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(0_0%_13%)] bg-[hsl(0_0%_13%)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[hsl(0_0%_75%)] uppercase tracking-wider">Task</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[hsl(0_0%_75%)] uppercase tracking-wider hidden sm:table-cell">Deadline</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[hsl(0_0%_75%)] uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[hsl(0_0%_75%)] uppercase tracking-wider">Status</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(0_0%_11%)]">
              {filteredItems.map((item) => {
                const days = getDaysLeft(item.deadline);
                const isUrgent = days <= 7;
                const isEditing = editingId === item._id;
                return (
                  <tr key={item._id} className={`group transition-colors ${isUrgent ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-[hsl(0_0%_11%)]"}`}>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-3" colSpan={3}>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input autoFocus value={editTask} onChange={(e) => setEditTask(e.target.value)} className="flex-1 bg-[hsl(0_0%_10%)] border border-[hsl(263_90%_60%/0.4)] rounded-lg px-3 py-1.5 text-sm text-white outline-none" />
                            <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-1.5 text-sm text-white outline-none [color-scheme:dark]" />
                            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as Category)} className="bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_28%)] rounded-lg px-3 py-1.5 text-sm text-white outline-none">
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(item._id)} className="p-1.5 rounded-md bg-[hsl(263_90%_60%/0.2)] text-violet-400 hover:bg-[hsl(263_90%_60%/0.3)]"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-md hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_75%)]"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${isUrgent ? "text-red-200" : "text-white"}`}>
                            {isUrgent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-2 mb-0.5" />}
                            {item.task}
                          </span>
                          <div className="sm:hidden mt-1 text-xs text-[hsl(0_0%_72%)]">{item.deadline}</div>
                        </td>
                        <td className="px-4 py-3 text-[hsl(0_0%_70%)] hidden sm:table-cell">{format(parseISO(item.deadline), "MMM d, yyyy")}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.Other}`}>{item.category}</span>
                        </td>
                        <td className="px-4 py-3"><UrgencyBadge days={days} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button onClick={() => startEdit(item._id, item.task, item.deadline, item.category)} className="p-1.5 rounded-md hover:bg-[hsl(0_0%_20%)] text-[hsl(0_0%_75%)] hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { if (confirm("Delete this deadline?")) removeDeadline({ id: item._id }); }} className="p-1.5 rounded-md hover:bg-red-900/40 text-[hsl(0_0%_75%)] hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
