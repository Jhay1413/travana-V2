import { Activity } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";

export default function AgencyAuditPage() {
  const { can } = useRole();
  if (!can("admin", "audit")) return <OwnerOnlyGate />;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start gap-3">
          <Activity className="mt-1 h-5 w-5 text-black/60 dark:text-white/60" />
          <div>
            <h2 className="text-lg font-semibold">Audit log</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              A timeline of who did what — sign-ins, role changes, member suspensions, branch edits,
              and other admin actions across the agency.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
        <Activity className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
        <div className="text-sm font-medium">Coming soon</div>
        <div className="mt-1 text-xs text-black/50 dark:text-white/50">
          Events are being captured on the server. The viewer lands here once it's wired up.
        </div>
      </div>
    </div>
  );
}
