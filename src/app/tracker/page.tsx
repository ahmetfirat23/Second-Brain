import { DeadlineTable } from "@/components/tracker/deadline-table";
import { Clock } from "lucide-react";

export default function TrackerPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-900/30 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Tracker</h1>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          Deadlines ≤7 days away are highlighted in red. Sorted by urgency.
        </p>
      </div>

      <DeadlineTable />
    </div>
  );
}
