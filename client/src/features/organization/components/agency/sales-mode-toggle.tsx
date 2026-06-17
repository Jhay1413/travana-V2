import { Loader2, TrendingUp } from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { useStartSelling, useStopSelling } from "@/hooks/mutations";

/**
 * Self-service toggle for org admins (and branch managers) to grant themselves
 * the `agent` role on themselves. Flipping it on adds Pipeline, Tickets,
 * Clients and the "My Sales" overview to their nav. Flipping it off removes
 * the role (but keeps any deals they created — those carry their own branch_id).
 */
export function SalesModeToggle() {
  const { hasRole, hasAnyRole } = useRoles();
  const isAgent = hasRole("agent");
  const eligible = hasAnyRole(["org_admin", "branch_manager"]);

  const start = useStartSelling();
  const stop  = useStopSelling();

  if (!eligible) return null;

  const busy = start.isPending || stop.isPending;

  return (
    <section className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-black/60 dark:text-white/60" />
            Also work as a sales agent
          </div>
          <p className="mt-1 text-xs text-black/55 dark:text-white/55">
            Adds Pipeline, Tickets, Clients, and a personal sales overview to your menu.
            You'll keep all of your admin access — this just enables selling alongside it.
            Deals you create attribute to a branch of your choice.
          </p>
        </div>

        <button
          onClick={() => (isAgent ? stop.mutate() : start.mutate())}
          disabled={busy}
          role="switch"
          aria-checked={isAgent}
          className={
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 " +
            (isAgent ? "bg-emerald-500" : "bg-black/15 dark:bg-white/15")
          }
          data-testid="toggle-sales-mode"
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
              (isAgent ? "translate-x-5" : "translate-x-0.5")
            }
          />
          {busy && <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />}
        </button>
      </div>
    </section>
  );
}
