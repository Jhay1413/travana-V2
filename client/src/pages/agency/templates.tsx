import { FileText } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";

export default function AgencyTemplatesPage() {
  const { can } = useRole();
  if (!can("admin", "sms")) return <OwnerOnlyGate />;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start gap-3">
          <FileText className="mt-1 h-5 w-5 text-black/60 dark:text-white/60" />
          <div>
            <h2 className="text-lg font-semibold">Templates</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Manage the email and SMS templates your agents send to clients — quote follow-ups,
              booking confirmations, balance reminders, and more.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
        <FileText className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
        <div className="text-sm font-medium">Coming soon</div>
        <div className="mt-1 text-xs text-black/50 dark:text-white/50">
          Until templates land here, edit text directly in the SMS Center.
        </div>
      </div>
    </div>
  );
}
