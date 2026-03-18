import { GoalsList } from "@/components/goals/goals-list";
import { Target } from "lucide-react";

export default function GoalsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 sm:py-8">
      <div className="mb-2 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-violet-900/30 flex items-center justify-center shrink-0">
            <Target className="w-3 h-3 sm:w-4 sm:h-4 text-violet-400" />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-white">Goals</h1>
        </div>
        <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] mt-0.5 sm:mt-1 ml-8 sm:ml-11 max-w-xl">
          Drag to prioritise. Click status to cycle. Tap goal to expand details.
        </p>
      </div>

      <GoalsList />
    </div>
  );
}
