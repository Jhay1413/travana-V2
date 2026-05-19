import { Target } from "lucide-react";
import AdminFinancialsTargets from "@/components/admin/admin-financials-targets";

export default function BranchTargetsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <Target className="h-5 w-5 text-black/60 dark:text-white/60" />
        <div className="text-sm font-medium">Targets</div>
        <div className="ml-auto text-xs text-black/50 dark:text-white/50">
          Targets apply to your branch and its agents.
        </div>
      </div>

      <AdminFinancialsTargets />
    </div>
  );
}
