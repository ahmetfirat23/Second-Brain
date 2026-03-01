import { FlashcardDeck } from "@/components/knowledge-base/flashcard-deck";
import { BookOpen } from "lucide-react";

export default function KnowledgeBasePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-pink-900/30 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-pink-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Knowledge Base</h1>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          SM-2 spaced repetition. LaTeX supported via $formula$ syntax.
        </p>
      </div>

      <FlashcardDeck />
    </div>
  );
}
