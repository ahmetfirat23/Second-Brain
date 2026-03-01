import { FlashcardDeck } from "@/components/knowledge-base/flashcard-deck";
import { BookOpen } from "lucide-react";

export default function KnowledgeBasePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-pink-900/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400" />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-white">Knowledge Base</h1>
        </div>
        <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] mt-0.5 sm:mt-1 ml-8 sm:ml-11">
          SM-2 spaced repetition. LaTeX: $formula$
        </p>
      </div>

      <FlashcardDeck />
    </div>
  );
}
