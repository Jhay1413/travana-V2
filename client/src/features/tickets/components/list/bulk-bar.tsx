import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsers } from "@/hooks/queries";
import { useBulkActions } from "../../state/use-bulk-actions";
import { TICKET_STATUSES } from "../../types";

const UNASSIGNED = "__unassigned";
const TRIGGER = "h-[34px] w-[170px] rounded-lg border-white/20 bg-white/10 text-[13px] text-white [&>svg]:text-white/70";

/** Dark bar shown while rows are ticked: assign, set status or clear. Runs one PATCH per ticket. */
export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const { data: users = [] } = useUsers();
  const { assign, setStatus, isRunning } = useBulkActions();

  const done = async (run: Promise<boolean>) => {
    if (await run) onClear();
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-none flex-wrap items-center gap-2.5 rounded-xl bg-social-navy-ink px-3.5 py-2 text-white"
      data-testid="ticket-bulk-bar"
    >
      <b className="text-[13px] font-semibold" data-testid="ticket-bulk-count">{ids.length} selected</b>
      <span className="flex-1" />
      <Select value="" onValueChange={(userId) => void done(assign(ids, userId === UNASSIGNED ? null : userId))} disabled={isRunning}>
        <SelectTrigger className={TRIGGER} aria-label="Assign selected tickets to" data-testid="ticket-bulk-assign">
          <SelectValue placeholder="Assign to…" />
        </SelectTrigger>
        <SelectContent align="end" className="max-h-72">
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id} className="text-[13px]">{u.name}</SelectItem>
          ))}
          <SelectItem value={UNASSIGNED} className="text-[13px]" data-testid="ticket-bulk-unassign">Unassigned</SelectItem>
        </SelectContent>
      </Select>
      <Select value="" onValueChange={(status) => void done(setStatus(ids, status))} disabled={isRunning}>
        <SelectTrigger className={TRIGGER} aria-label="Set status of selected tickets" data-testid="ticket-bulk-status">
          <SelectValue placeholder="Set status…" />
        </SelectTrigger>
        <SelectContent align="end">
          {TICKET_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-[13px]">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button type="button" onClick={onClear} className="text-[13px] font-medium text-white/70 hover:text-white" data-testid="ticket-bulk-clear">
        Clear
      </button>
    </div>
  );
}
