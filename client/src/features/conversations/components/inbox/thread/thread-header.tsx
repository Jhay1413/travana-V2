import { CheckCircle2, Clock, Ellipsis, Loader2, User } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AiStatusControl } from "../../ai-status-control";
import { ChannelAvatar, ChannelPill, CopyButton } from "../shared";
import { SNOOZE_PRESETS, snoozeLabel, snoozeUntil, type SnoozePresetId } from "../lib";
import type { Conversation } from "../../../types";
import { ConversationHeaderName } from "./header-name";

export interface ThreadHeaderProps {
  conversation: Conversation;
  isDone: boolean;
  clientId: string | null;
  canTestAi: boolean;
  showClientPaneButton: boolean;
  onSnooze(presetId: SnoozePresetId): void;
  onUnsnooze(): void;
  onDone(): void;
  onReopen(): void;
  onMarkUnread(): void;
  onOpenClientPane(): void;
  onCreateEnquiry(): void;
  enquiryGenerating?: boolean;
  onCreateTicket(): void;
  onOpenTestAi(): void;
}

export function ThreadHeader({
  conversation,
  isDone,
  clientId,
  canTestAi,
  showClientPaneButton,
  onSnooze,
  onUnsnooze,
  onDone,
  onReopen,
  onMarkUnread,
  onOpenClientPane,
  onCreateEnquiry,
  enquiryGenerating = false,
  onCreateTicket,
  onOpenTestAi,
}: ThreadHeaderProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { contact, channel } = conversation;
  const snoozedNow = conversation.snoozed && !isDone;
  // Instagram / Messenger handles are opaque ids, never useful to show.
  const contactLine = channel === "email" || channel === "sms" || channel === "whatsapp" ? contact.handle : "";
  const now = new Date();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/conversations?conversation=${encodeURIComponent(conversation.id)}`);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-social-border px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <ChannelAvatar name={contact.displayName} avatarUrl={contact.avatarUrl} channel={channel} size={44} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <ConversationHeaderName conversation={conversation} />
            <ChannelPill channel={channel} />
          </div>
          {contactLine && (
            <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <span className="truncate">{contactLine}</span>
              <CopyButton value={contactLine} label={channel === "email" ? "Copy email" : "Copy phone number"} />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isDone &&
          (snoozedNow ? (
            <Button type="button" variant="outline" className="h-9 gap-1.5 rounded-lg" onClick={onUnsnooze}>
              <Clock className="h-4 w-4" />
              Wake now
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-9 gap-1.5 rounded-lg" data-testid="conversation-snooze">
                  <Clock className="h-4 w-4" />
                  Snooze
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {SNOOZE_PRESETS.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => onSnooze(p.id)} className="flex flex-col items-start gap-0">
                    <span className="text-sm">{p.label}</span>
                    <span className="text-[12px] text-muted-foreground">{snoozeLabel(snoozeUntil(p.id, now), now)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

        {isDone ? (
          <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={onReopen} data-testid="conversation-reopen">
            Reopen
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            className="h-9 gap-1.5 rounded-lg border-[#A7F3D0] bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] hover:text-[#047857] dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
            data-testid="conversation-mark-done"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark done
          </Button>
        )}

        {showClientPaneButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={onOpenClientPane}
            title="Show client details"
            aria-label="Show client details"
          >
            <User className="h-4 w-4" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-lg" title="More" aria-label="More">
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={onCreateEnquiry} disabled={enquiryGenerating}>
              {enquiryGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {enquiryGenerating ? "Drafting…" : "Create enquiry"}
            </DropdownMenuItem>
            {clientId ? (
              <DropdownMenuItem onClick={onCreateTicket}>Create ticket</DropdownMenuItem>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem disabled>Create ticket</DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">Link a client first</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {clientId && <DropdownMenuItem onClick={() => navigate(`/clients/${clientId}`)}>Open client page</DropdownMenuItem>}
            <DropdownMenuItem onClick={onMarkUnread}>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void copyLink()}>Copy link to chat</DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <AiStatusControl conversationId={conversation.id} />
            </div>
            {canTestAi && <DropdownMenuItem onClick={onOpenTestAi}>Test AI</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
