import type { ReactNode } from "react";
import type { Conversation, ConversationMessage } from "../../../types";
import type { SnoozePresetId } from "../lib";
import { CreatedEnquiryBar } from "./created-enquiry-bar";
import { MessageList } from "./message-list";
import { ThreadHeader } from "./thread-header";
import { ThreadToolbar } from "./thread-toolbar";

export interface ThreadPaneProps {
  /** Merged with the optimistic overlay by the owner. */
  conversation: Conversation | null;
  messages: ConversationMessage[];
  isLoadingMessages: boolean;
  typing: boolean | string;
  currentUser: { id: string; name: string } | null;
  staff: { id: string; name: string }[];
  staffLoading?: boolean;
  canTestAi: boolean;
  /** Reserved: not consumed by the pane yet, kept so the owner call site stays stable. */
  canManageChannels: boolean;
  onAssign(userId: string | null): void;
  onSnooze(presetId: SnoozePresetId): void;
  onUnsnooze(): void;
  onDone(): void;
  onReopen(): void;
  isDone: boolean;
  /** Local-only; the owner implements it. */
  onMarkUnread(): void;
  onOpenClientPane(): void;
  showClientPaneButton: boolean;
  onCreateEnquiry(): void;
  /** True while the AI is drafting an enquiry; disables the menu item. */
  enquiryGenerating?: boolean;
  onCreateTicket(): void;
  clientId: string | null;
  onOpenTestAi(): void;
  /** Enquiry created from this chat this session; shows the green bar above the composer. */
  createdEnquiry?: { title: string; href: string };
  onDismissCreatedEnquiry?(): void;
  /** The owner mounts <Composer/> so drafts and attachments stay owner-controlled. */
  composer: ReactNode;
}

const SHELL = "flex min-w-0 flex-1 flex-col rounded-2xl border border-social-border bg-card";

export function ThreadPane({
  conversation,
  messages,
  isLoadingMessages,
  typing,
  currentUser,
  staff,
  staffLoading,
  canTestAi,
  onAssign,
  onSnooze,
  onUnsnooze,
  onDone,
  onReopen,
  isDone,
  onMarkUnread,
  onOpenClientPane,
  showClientPaneButton,
  onCreateEnquiry,
  enquiryGenerating = false,
  onCreateTicket,
  clientId,
  onOpenTestAi,
  createdEnquiry,
  onDismissCreatedEnquiry,
  composer,
}: ThreadPaneProps) {
  if (!conversation) {
    return (
      <div className={`${SHELL} items-center justify-center text-center`} data-testid="thread-empty">
        <div className="text-[16px] font-semibold">Pick a conversation</div>
        <div className="mt-1 text-[13px] text-muted-foreground">Choose a chat on the left to read it and reply.</div>
      </div>
    );
  }

  return (
    <div className={SHELL} data-testid="thread-pane">
      <ThreadHeader
        conversation={conversation}
        isDone={isDone}
        clientId={clientId}
        canTestAi={canTestAi}
        showClientPaneButton={showClientPaneButton}
        onSnooze={onSnooze}
        onUnsnooze={onUnsnooze}
        onDone={onDone}
        onReopen={onReopen}
        onMarkUnread={onMarkUnread}
        onOpenClientPane={onOpenClientPane}
        onCreateEnquiry={onCreateEnquiry}
        enquiryGenerating={enquiryGenerating}
        onCreateTicket={onCreateTicket}
        onOpenTestAi={onOpenTestAi}
      />
      <ThreadToolbar
        conversation={conversation}
        isDone={isDone}
        currentUser={currentUser}
        staff={staff}
        staffLoading={staffLoading}
        onAssign={onAssign}
      />
      <MessageList conversation={conversation} messages={messages} isLoading={isLoadingMessages} typing={typing} />
      {createdEnquiry && <CreatedEnquiryBar href={createdEnquiry.href} onDismiss={() => onDismissCreatedEnquiry?.()} />}
      {composer}
    </div>
  );
}
