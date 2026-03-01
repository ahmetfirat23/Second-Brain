import { BrainDumpEditor } from "@/components/brain-dump/brain-dump-editor";
import { Brain } from "lucide-react";

export default function BrainDumpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(263_90%_65%/0.15)] flex items-center justify-center">
            <Brain className="w-4 h-4 text-[hsl(263_90%_70%)]" />
          </div>
          <h1 className="text-xl font-semibold text-white">Brain Dump</h1>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          Press Enter to capture quick thoughts. Use the text area below for longer dumps to tidy with AI.
        </p>
      </div>

      <BrainDumpEditor />
    </div>
  );
}
