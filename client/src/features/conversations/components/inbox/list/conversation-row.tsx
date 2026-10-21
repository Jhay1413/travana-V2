import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { Conversation } from "../../../types";
import { formatRowTime, rowStatus, type SnoozePresetId } from "../lib";
import { ChannelAvatar, StatusPill, TagPill, toneFor } from "../shared";

import { RowHoverActions } from "./row-hover-actions";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
}

export interface ConversationRowProps {
  conversation: Conversation;
  selected: boolean;
  isDoneTab: boolean;
  staff: { id: string; name: string }[];
  currentUserId?: string | null;
  /** Unsent composer text for this conversation; replaces the preview with a "Draft" tag. */
  draftPreview?: string;
  now: Date;
  onSelect: () => void;
  onSnooze: (presetId: SnoozePresetId) => void;
  onUnsnooze: () => void;
  onDone: () => void;
  onReopen: () => void;
  onAssign: (userId: string | null) => void;
}

export function ConversationRow({ conversation: c, selected, isDoneTab, staff, currentUserId, draftPreview, now, onSelect, onSnooze, onUnsnooze, onDone, onReopen, onAssign }: ConversationRowProps) {
  const status = rowStatus(c, now);
  const tag = c.tags?.[0];

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group flex cursor-pointer gap-3 border-b border-social-border px-4 py-3 outline-none",
        "hover:bg-[#F8FAFC] focus-visible:bg-[#F8FAFC] dark:hover:bg-muted/40 dark:focus-visible:bg-muted/40",
        selected && "bg-[#F0F9FF] shadow-[inset_3px_0_0_#F59E0B] hover:bg-[#F0F9FF] dark:bg-sky-950/30",
      )}
      data-testid={`conversation-row-${c.id}`}
    >
      <ChannelAvatar name={c.contact.displayName} avatarUrl={c.contact.avatarUrl} channel={c.channel} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-[14px]", c.unread ? "font-semibold" : "font-medium")}>
            {c.contact.displayName}
          </span>
          <div className="flex h-7 shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1.5 group-focus-within:hidden group-hover:hidden">
              <span className={cn("text-[12px]", c.unread ? "font-semibold text-social-orange-text" : "text-social-muted")}>
                {formatRowTime(c.lastActivityAt, now)}
              </span>
              {c.unread && <span className="h-2 w-2 rounded-full bg-social-orange" aria-label="Unread" />}
            </div>
            <div className="hidden group-focus-within:flex group-hover:flex">
              <RowHoverActions
                snoozed={c.snoozed}
                isDoneTab={isDoneTab}
                staff={staff}
                currentUserId={currentUserId ?? null}
                now={now}
                onSnooze={onSnooze}
                onUnsnooze={onUnsnooze}
                onDone={onDone}
                onReopen={onReopen}
                onAssign={onAssign}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          {draftPreview ? (
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-social-muted">
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                Draft
              </span>
              <span className="truncate">{draftPreview}</span>
            </p>
          ) : (
            <p className={cn("truncate text-[13px]", c.unread ? "font-medium text-foreground" : "text-social-muted")}>
              {c.preview}
            </p>
          )}
          {c.assignee ? (
            <span
              className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-semibold", toneFor(c.assignee))}
              title={c.assignee}
            >
              {initialsOf(c.assignee)}
            </span>
          ) : (
            <span
              className="h-[22px] w-[22px] shrink-0 rounded-full border border-dashed border-social-muted/60"
              title="Unassigned"
            />
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {tag && <TagPill tag={tag} />}
          <StatusPill kind={status.kind} label={status.label} />
        </div>
      </div>
    </div>
  );
}
