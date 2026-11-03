import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        {sub && <div className="text-[12px] text-social-muted">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export interface WhenYouSaveProps {
  firstName: string;
  followUp: boolean;
  onFollowUp(v: boolean): void;
  keepLinked: boolean;
  onKeepLinked(v: boolean): void;
  assigneeId: string;
  onAssignee(id: string): void;
  /** Inline error under the owner row. */
  error?: string;
}

/** What happens besides creating the enquiry: follow-up task, chat note, owner. */
export function WhenYouSave(p: WhenYouSaveProps) {
  return (
    <section className="mt-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">When you save</div>
      <div className="divide-y divide-social-border">
        <Row title="Add a follow-up task" sub={`Call ${p.firstName} to confirm the details · due tomorrow 10:00`}>
          <Switch checked={p.followUp} onCheckedChange={p.onFollowUp} aria-label="Add a follow-up task" />
        </Row>
        <Row title="Keep this chat linked" sub="An internal note links the enquiry to this chat">
          <Switch checked={p.keepLinked} onCheckedChange={p.onKeepLinked} aria-label="Keep this chat linked" />
        </Row>
        <Row title="Assigned to">
          <UserReassignSelect value={p.assigneeId} onValueChange={p.onAssignee} className="h-9 w-[190px]" />
        </Row>
      </div>
      {p.error && (
        <p role="alert" className="mt-1 text-[12px] text-red-600 dark:text-red-400">
          {p.error}
        </p>
      )}
    </section>
  );
}
