import { Loader2, SearchX, Users } from "lucide-react";
import type { OrgMember } from "@/features/organization/api/organization.api";
import type { PendingInvite } from "@/features/invite/api/invite.api";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import type { MemberFilters } from "../../lib/member-filters";
import { TEAM_CARD } from "../shared/team-styles";
import { MemberRow, type MemberRowProps } from "./member-row";
import { MemberToolbar } from "./member-toolbar";
import { PendingInviteRows } from "./pending-invite-rows";
import { cn } from "@/lib/utils";

type RowHandlers = Pick<MemberRowProps, "onRoleChange" | "onOpen" | "onSuspend" | "onReactivate" | "onRemove" | "onArchive">;

interface MemberTableCardProps extends RowHandlers {
  members: OrgMember[];
  invites: PendingInvite[];
  filters: MemberFilters;
  onFilters: (patch: Partial<MemberFilters>) => void;
  onClear: () => void;
  filtered: boolean;
  counts: { active: number; suspended: number };
  branches: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  archivable: ReadonlySet<string>;
  roleBusy: boolean;
}

const TH = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";

function EmptyRows({ filtered, status, onClear }: { filtered: boolean; status: MemberFilters["status"]; onClear: () => void }) {
  const title = filtered
    ? "No one matches those filters"
    : status === "suspended"
      ? "No suspended members"
      : "No active members";
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center" data-testid="team-empty">
          {filtered ? <SearchX className="h-7 w-7 text-social-muted" /> : <Users className="h-7 w-7 text-social-muted" />}
          <div className="text-[14px] font-semibold">{title}</div>
          {filtered && (
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={onClear}>
              Clear filters
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function MemberTableCard(p: MemberTableCardProps) {
  const empty = p.members.length === 0 && p.invites.length === 0;
  return (
    <section className={cn(TEAM_CARD, "overflow-hidden")} aria-label="Team members" data-testid="member-table-card">
      <MemberToolbar filters={p.filters} onChange={p.onFilters} counts={p.counts} branches={p.branches} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className={TH}>Member</th>
              <th className={TH}>Role</th>
              <th className={TH}>Branch</th>
              <th className={TH}>Permissions</th>
              <th className={TH}>Status</th>
              <th className={cn(TH, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {p.isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-social-muted" aria-label="Loading team" />
                </td>
              </tr>
            ) : (
              <>
                {p.members.map((m) => (
                  <MemberRow
                    key={m.user.id}
                    member={m}
                    currentUserId={p.currentUserId}
                    isAdmin={p.isAdmin}
                    canArchive={p.archivable.has(m.user.id)}
                    roleBusy={p.roleBusy}
                    onRoleChange={p.onRoleChange}
                    onOpen={p.onOpen}
                    onSuspend={p.onSuspend}
                    onReactivate={p.onReactivate}
                    onRemove={p.onRemove}
                    onArchive={p.onArchive}
                  />
                ))}
                <PendingInviteRows invites={p.invites} />
                {empty && <EmptyRows filtered={p.filtered} status={p.filters.status} onClear={p.onClear} />}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
