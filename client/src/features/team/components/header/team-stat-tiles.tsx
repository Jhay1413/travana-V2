import type { ReactNode } from "react";
import { PauseCircle, Shield, Users } from "lucide-react";
import type { SeatUsage } from "@/features/organization/api/organization.api";
import { cn } from "@/lib/utils";
import { pendingNote, seatPercent, seatsFull, seatsLabel } from "../../lib/seat-math";
import { TEAM_CARD } from "../shared/team-styles";

function Tile({ icon, label, value, testId, children }: { icon: ReactNode; label: string; value: ReactNode; testId: string; children?: ReactNode }) {
  return (
    <div className={cn(TEAM_CARD, "min-w-0 flex-1 basis-[200px] p-4 xl:p-5")} data-testid={testId}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted xl:text-[12px]">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[26px] font-semibold leading-tight xl:text-[30px]">{value}</div>
      {children}
    </div>
  );
}

interface TeamStatTilesProps {
  active: number;
  suspended: number;
  seats: SeatUsage | undefined;
}

export function TeamStatTiles({ active, suspended, seats }: TeamStatTilesProps) {
  const full = seats ? seatsFull(seats) : false;
  const note = seats ? pendingNote(seats.pendingInvites) : null;
  return (
    <div className="flex flex-wrap gap-4">
      <Tile icon={<Users className="h-4 w-4" />} label="Active members" value={active} testId="stat-active" />
      <Tile icon={<PauseCircle className="h-4 w-4" />} label="Suspended" value={suspended} testId="stat-suspended" />
      <Tile
        icon={<Shield className="h-4 w-4" />}
        label="Seats used"
        value={seats ? seatsLabel(seats.used, seats.limit) : "–"}
        testId="stat-seats"
      >
        {seats && (
          <>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Seats used"
              aria-valuenow={seats.used}
              aria-valuemin={0}
              aria-valuemax={seats.limit ?? undefined}
            >
              <div
                className={cn("h-full rounded-full", full ? "bg-status-failed-fg" : "bg-social-orange")}
                style={{ width: `${seatPercent(seats.used, seats.limit)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[12px] text-social-muted">
              {full ? "All seats are in use. " : seats.limit === null ? "Unlimited seats. " : ""}
              {note}
            </div>
          </>
        )}
      </Tile>
    </div>
  );
}
