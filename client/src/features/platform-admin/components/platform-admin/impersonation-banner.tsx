import { useLocation } from "wouter";
import { Eye, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/queries";
import { useStopImpersonation } from "@/hooks/mutations";

export function ImpersonationBanner() {
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();
  const stop = useStopImpersonation();

  // Impersonation = the real DB role is platform_admin AND the effective scope
  // is something else (or any orgId is set). resolveOrgAndBranchForUser sets
  // orgRole='org_admin' + orgId=<target> when impersonating.
  const isImpersonating =
    !!user &&
    user.role === "platform_admin" &&
    user.orgRole !== "platform_admin" &&
    !!user.orgId;

  if (!isImpersonating) return null;

  const handleStop = async () => {
    try {
      await stop.mutateAsync();
      navigate("/platform-admin");
    } catch (err) {
      console.error("Failed to stop impersonation:", err);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
      data-testid="impersonation-banner"
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>
          Impersonating <strong>{user.orgName ?? "organization"}</strong> as platform admin.
        </span>
      </div>
      <button
        onClick={handleStop}
        disabled={stop.isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-white/40 px-3 py-1 text-xs font-medium hover:bg-white/60 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20"
        data-testid="button-stop-impersonating"
      >
        {stop.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        Stop impersonating
      </button>
    </div>
  );
}
