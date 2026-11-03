import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERMISSION_COUNT,
  PERMISSION_GROUPS,
  REFERRAL_NOTE,
  permissionCount,
  roleDisplay,
  roleHasPermission,
} from "../../lib/role-permissions";

/** Read-only: the role's default permissions. There are no per-person switches. */
export function PermissionsTab({ role }: { role: string | null | undefined }) {
  const d = roleDisplay(role);
  const referral = role === "referral_agent";
  const count = permissionCount(role);

  return (
    <div data-testid="permissions-tab">
      <div className="rounded-xl border border-social-border bg-muted/40 px-4 py-3.5">
        <div className="text-[13px] font-semibold">
          {d.label} defaults{referral ? "" : `, ${count} of ${PERMISSION_COUNT} on`}
        </div>
        <p className="mt-0.5 text-[12px] text-social-muted" data-testid="permissions-copy">
          These are the {d.label} defaults. Access follows the role; change the role to change access.
        </p>
        {!referral && (
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Permissions on" aria-valuenow={count} aria-valuemin={0} aria-valuemax={PERMISSION_COUNT}>
            <div className="h-full rounded-full bg-social-orange" style={{ width: `${(count / PERMISSION_COUNT) * 100}%` }} />
          </div>
        )}
      </div>
      {referral ? (
        <p className="mt-4 text-[13px] text-social-muted">{REFERRAL_NOTE}. Referral partners only use the referral hub.</p>
      ) : (
        PERMISSION_GROUPS.map((g) => {
          const on = g.items.filter((i) => roleHasPermission(role, i.key)).length;
          return (
            <div key={g.group} className="mt-4">
              <div className="flex items-center justify-between py-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-social-muted">
                <span>{g.group}</span>
                <span className="normal-case tracking-normal font-medium">
                  {on} of {g.items.length} on
                </span>
              </div>
              {g.items.map((it) => {
                const has = roleHasPermission(role, it.key);
                return (
                  <div key={it.key} className="flex items-start gap-3 border-t border-social-border py-2.5" data-perm={it.key} data-on={has}>
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", has ? "bg-status-scheduled-bg text-status-scheduled-fg" : "bg-muted text-social-muted")}>
                      {has ? <Check className="h-3 w-3" strokeWidth={3} /> : <Minus className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">
                        {it.label}
                        <span className="ml-2 text-[11px] font-semibold text-social-muted">{has ? "On" : "Off"}</span>
                      </div>
                      <div className="text-[12px] text-social-muted">{it.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
