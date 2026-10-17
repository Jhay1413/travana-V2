import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Reply as ReplyIcon, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiInsertButton } from "@/components/shared/emoji-insert-button";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { useCreateReply } from "@/features/reply";
import { usePendingAttachments } from "@/features/attachment";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { ticketErrorMessage } from "../../lib/error-message";
import { PendingFileChips } from "../shared/pending-file-chips";
import type { ReplyTarget } from "../thread/use-note-actions";

const COMPOSER_MAX_HEIGHT_PX = 140;
const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,application/pdf";

/**
 * Composer for a ticket's team notes. Enter sends, Shift+Enter adds a line,
 * a file-only note is posted as "Attachment". Uses the ticket attachment
 * hooks (not the inbox's).
 */
export function ReplyComposer({
  ticketId,
  replyingTo,
  onCancelReplyTo,
  onSent,
}: {
  ticketId: string;
  replyingTo: ReplyTarget | null;
  onCancelReplyTo: () => void;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createReply = useCreateReply(ticketId);
  const { files, addFiles, removeFile, uploadAll } = usePendingAttachments();

  // Picking someone to reply to puts the cursor straight into the box.
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  // Auto-grow up to a max height, and shrink back after send resets the text.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [text]);

  const canSubmit = !!text.trim() || files.length > 0;

  const submit = () => {
    const trimmed = text.trim();
    if (!canSubmit || createReply.isPending) return;
    if (!currentUser?.id) {
      toast({ title: "Please wait while loading user data", variant: "destructive" });
      return;
    }
    createReply.mutate(
      { userId: currentUser.id, content: trimmed || "Attachment", parentReplyId: replyingTo?.parentReplyId },
      {
        onSuccess: async (reply) => {
          setText("");
          if (files.length > 0) {
            const { failed } = await uploadAll(ticketId, reply.id);
            if (failed > 0) toast({ title: `${failed} attachment(s) failed to upload`, variant: "destructive" });
          }
          onSent();
        },
        onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to add reply"), variant: "destructive" }),
      },
    );
  };

  // Insert at the caret and hand focus back so typing continues where the emoji landed.
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="flex-none border-t border-social-border bg-card px-4 py-3">
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-status-posted-bg px-3 py-1.5 text-[12px] text-status-posted-fg" data-testid="ticket-reply-replying-to">
          <ReplyIcon className="h-3.5 w-3.5" />
          <span>
            Replying to <strong>{replyingTo.authorName}</strong>
          </span>
          <button type="button" onClick={onCancelReplyTo} className="ml-auto" aria-label="Cancel reply" data-testid="ticket-reply-cancel-reply-to">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="rounded-xl border border-social-border bg-card px-4 pb-2.5 pt-3">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write a note for the team…"
          rows={2}
          spellCheck
          lang="en-GB"
          className="min-h-[56px] w-full resize-none border-0 bg-transparent px-0 py-1 text-[14px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="ticket-reply-composer-input"
        />
        <PendingFileChips files={files} onRemove={removeFile} testIdPrefix="ticket-reply-pending" className="mt-1" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-social-muted">
            <EmojiInsertButton onPick={insertEmoji} side="top" className="[&_button]:h-8 [&_button]:w-8" data-testid="ticket-reply-emoji" />
            <input ref={fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" data-testid="ticket-reply-attach-input"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
              className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-muted hover:text-foreground"
              data-testid="ticket-reply-attach"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>
          </div>
          <Button type="button" className={`${PRIMARY_ACTION} h-10`} onClick={submit} disabled={!canSubmit || createReply.isPending} data-testid="ticket-reply-send">
            {createReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
