import { useOrgSeats } from "@/features/organization/api/use-organization-queries";
import { cn } from "@/lib/utils";
import { MATRIX_ROLES, PERMISSION_COUNT, permissionCount } from "../../lib/role-permissions";
import { pendingNote, seatPercent, seatsAfter, seatsOver } from "../../lib/seat-math";
import { RolePill } from "../shared/role-pill";
import { TEAM_CARD } from "../shared/team-styles";

/** Seats now and after sending, the role summary, and what happens next. */
export function SeatsSidebar({ adding, onMatrix }: { adding: number; onMatrix: () => void }) {
  const { data: seats } = useOrgSeats();
  const after = seats ? seatsAfter(seats.used, adding) : 0;
  const over = seats ? seatsOver(seats.used, adding, seats.limit) : 0;
  const note = seats ? pendingNote(seats.pendingInvites) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="invite-sidebar">
      <section className={cn(TEAM_CARD, "p-4")} aria-label="Seats">
        <div className="flex justify-between text-[14px] font-semibold">
          <span>Seats</span>
          {seats && (
            <span data-testid="seats-summary">
              {seats.used} to {after}
              {seats.limit !== null ? ` of ${seats.limit}` : ""}
            </span>
          )}
        </div>
        {seats && (
          <>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Seats after sending" aria-valuenow={after}>
              <div
                className={cn("h-full rounded-full", over > 0 ? "bg-status-failed-fg" : "bg-social-orange")}
                style={{ width: `${seatPercent(after, seats.limit)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-social-muted">
              These invites use {adding} {adding === 1 ? "seat" : "seats"}.{note ? ` Current use ${note}.` : ""}
            </p>
            {over > 0 && (
              <p className="mt-1.5 text-[12px] font-semibold text-status-failed-fg" role="alert" data-testid="seats-over">
                That is {over} more than your {seats.limit} seats. Remove some people or free up seats.
              </p>
            )}
          </>
        )}
      </section>

      <section className={cn(TEAM_CARD, "p-4")} aria-label="What each role can do">
        <div className="mb-1.5 text-[14px] font-semibold">What each role can do</div>
        {MATRIX_ROLES.map((r) => (
          <div key={r} className="flex items-center justify-between gap-2 border-t border-social-border py-2">
            <RolePill role={r} />
            <span className="text-[12px] text-social-muted">
              {permissionCount(r)} of {PERMISSION_COUNT} permissions
            </span>
          </div>
        ))}
        <button type="button" onClick={onMatrix} className="mt-2 text-[13px] font-semibold text-social-orange-text hover:underline">
          See the full table
        </button>
      </section>

      <section className={cn(TEAM_CARD, "p-4")} aria-label="After they join">
        <div className="mb-1.5 text-[14px] font-semibold">After they join</div>
        <p className="text-[12px] leading-relaxed text-social-muted">
          Everyone gets an email with a 7-day link to set their password. Owner / Admin cannot be invited directly: invite as Branch Manager or Agent, then change the role from Teams &amp; Roles.
        </p>
      </section>
    </div>
  );
}
