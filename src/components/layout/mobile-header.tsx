"use client";

import { Brain, Command } from "lucide-react";

interface MobileHeaderProps {
  onCmdK: () => void;
}

export function MobileHeader({ onCmdK }: MobileHeaderProps) {
  return (
    <header className="lg:hidden flex items-center justify-between px-3 h-9 border-b border-[hsl(0_0%_22%)] bg-[hsl(0_0%_5%)] shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-5 h-5 rounded bg-[hsl(263_90%_65%)] flex items-center justify-center shrink-0">
          <Brain className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-white truncate">Mergen</span>
      </div>
      <button
        onClick={onCmdK}
        className="p-1.5 rounded-md text-[hsl(0_0%_68%)] hover:text-white hover:bg-[hsl(0_0%_13%)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
        title="Search"
      >
        <Command className="w-3.5 h-3.5" />
      </button>
    </header>
  );
}
