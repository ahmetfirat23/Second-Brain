import { VaultList } from "@/components/vault/vault-list";
import { Layers } from "lucide-react";

export default function VaultPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">The Vault</h1>
        </div>
        <p className="text-sm text-[hsl(0_0%_45%)] ml-11">
          Links and resources. Sorted by urgency. Bulk paste Chrome tabs in one shot.
        </p>
      </div>

      <VaultList />
    </div>
  );
}
