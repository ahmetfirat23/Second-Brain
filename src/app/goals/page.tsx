import { GoalsList } from "@/components/goals/goals-list";
import { Target } from "lucide-react";

export default function GoalsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-violet-900/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-violet-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Goals</h1>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          Things you want to do — vague or specific, short or long. Drag to prioritise. Status cycles on click.
        </p>
      </div>

      <GoalsList />
    </div>
  );
}
