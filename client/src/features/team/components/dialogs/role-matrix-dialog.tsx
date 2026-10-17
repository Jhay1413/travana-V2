import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import {
  MATRIX_ROLES,
  PERMISSION_COUNT,
  PERMISSION_GROUPS,
  REFERRAL_NOTE,
  ROLE_DISPLAY,
  permissionCount,
  roleHasPermission,
} from "../../lib/role-permissions";

/** Read-only table of what each role starts with. Access follows the role. */
export function RoleMatrixDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-h-[calc(100vh-3rem)] w-[calc(100vw-2rem)] max-w-[880px] flex-col gap-3 rounded-2xl border-social-border p-6 sm:rounded-2xl"
        data-testid="role-matrix"
      >
        <div className="pr-8">
          <DialogTitle className="text-[20px] font-semibold">What each role can do</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-social-muted">
            These are the role defaults. Access follows the role, so to change what someone can do, change their role.
          </DialogDescription>
        </div>
        <div className="min-h-0 overflow-auto rounded-xl border border-social-border">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="bg-muted/40">
                <th className="sticky left-0 top-0 z-10 bg-muted px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">
                  Permission
                </th>
                {MATRIX_ROLES.map((r) => (
                  <th key={r} className="sticky top-0 bg-muted px-3 py-2.5 text-center text-[12px] font-semibold leading-tight">
                    {ROLE_DISPLAY[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((g) => (
                <GroupRows key={g.group} group={g} />
              ))}
              <tr className="border-t border-social-border">
                <td className="sticky left-0 bg-card px-4 py-2.5 font-semibold">Total</td>
                {MATRIX_ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center font-semibold">
                    {permissionCount(r)} of {PERMISSION_COUNT}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-social-muted" data-testid="referral-note">
          <b className="font-semibold text-foreground">{ROLE_DISPLAY.referral_agent.label}</b>: {REFERRAL_NOTE}. Referral partners only use the referral hub, so they are not part of this table.
        </p>
        <div className="flex justify-end">
          <Button type="button" className={PRIMARY_ACTION} onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GroupRows({ group }: { group: (typeof PERMISSION_GROUPS)[number] }) {
  return (
    <>
      <tr>
        <td colSpan={MATRIX_ROLES.length + 1} className="bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.05em] text-social-muted">
          {group.group}
        </td>
      </tr>
      {group.items.map((it) => (
        <tr key={it.key} className="border-t border-social-border">
          <td className="sticky left-0 bg-card px-4 py-2.5 font-medium">{it.label}</td>
          {MATRIX_ROLES.map((r) => (
            <td key={r} className="px-3 py-2.5 text-center">
              {roleHasPermission(r, it.key) ? (
                <Check className="mx-auto h-4 w-4 text-status-scheduled-fg" strokeWidth={2.6} aria-label="Included" />
              ) : (
                <span className="text-social-muted/60">
                  –<span className="sr-only">Not included</span>
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
