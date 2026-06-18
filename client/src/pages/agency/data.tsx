import { ClipboardList } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";

export default function AgencyDataPage() {
  const { can } = useRole();
  if (!can("admin", "branding")) return <OwnerOnlyGate />;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-1 h-5 w-5 text-black/60 dark:text-white/60" />
          <div>
            <h2 className="text-lg font-semibold">Reference data</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Destinations, resorts, and tour operators — the lookup lists that power quotes,
              bookings, and the dashboards on the Agency Overview.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
        <ClipboardList className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
        <div className="text-sm font-medium">Coming soon</div>
        <div className="mt-1 text-xs text-black/50 dark:text-white/50">
          Use the admin lookup tables under <span className="font-mono">/admin/lookup</span> in the meantime.
        </div>
      </div>
    </div>
  );
}
