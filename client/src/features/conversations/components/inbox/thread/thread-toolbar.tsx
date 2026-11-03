import { snoozeLabel } from "../lib";
import { TagPill } from "../shared";
import type { Conversation } from "../../../types";
import { AssignControl } from "./assign-control";
import { ConversationTypeControl } from "./conversation-type-control";

export interface ThreadToolbarProps {
  conversation: Conversation;
  isDone: boolean;
  currentUser: { id: string; name: string } | null;
  staff: { id: string; name: string }[];
  staffLoading?: boolean;
  onAssign(userId: string | null): void;
}

export function ThreadToolbar({ conversation, isDone, currentUser, staff, staffLoading, onAssign }: ThreadToolbarProps) {
  const until = conversation.snoozedUntil ? new Date(conversation.snoozedUntil) : null;
  const showSnoozed = conversation.snoozed && !isDone && until !== null && !Number.isNaN(until.getTime());

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-social-border px-5 py-2.5">
      <AssignControl conversation={conversation} currentUser={currentUser} staff={staff} staffLoading={staffLoading} onAssign={onAssign} />
      <span className="h-5 w-px bg-social-border" aria-hidden />
      <ConversationTypeControl conversation={conversation} />
      {conversation.tags && conversation.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {conversation.tags.map((t) => (
            <TagPill key={t.id} tag={t} />
          ))}
        </div>
      )}
      {showSnoozed && until && (
        <span className="ml-auto text-[12px] text-muted-foreground">Snoozed · {snoozeLabel(until, new Date())}</span>
      )}
    </div>
  );
}
