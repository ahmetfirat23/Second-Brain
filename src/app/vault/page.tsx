import { VaultList } from "@/components/vault/vault-list";
import { Layers } from "lucide-react";

export default function VaultPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Layers className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
          </div>
          <h1 className="text-base sm:text-xl font-semibold text-white">The Vault</h1>
        </div>
        <p className="text-[10px] sm:text-xs text-[hsl(0_0%_68%)] mt-0.5 sm:mt-1 ml-8 sm:ml-11">
          Links by urgency. Bulk paste tabs.
        </p>
      </div>

      <VaultList />
    </div>
  );
}
