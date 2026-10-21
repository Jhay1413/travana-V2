import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Lock, Paperclip, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { EMOJI_CATEGORIES } from "@/lib/emoji";
import { NOTE_ATTACHMENT_ACCEPT, filterNoteAttachmentFiles, formatFileSize } from "@/lib/note-attachments";
import { useToast } from "@/hooks/use-toast";
import { useCreateNoteWithAttachments } from "@/features/note";

// ─── Bottom message composer ────────────────────────────────────────────────
// Posts a transaction note — the same store the Notes tab reads from — so a
// message sent here shows up immediately regardless of which tab is active.
// Styled to match the inbox's message box: bordered card, auto-growing
// textarea (Enter sends), emoji picker, and the "Send | ⌄" outline button.

const COMPOSER_MAX_HEIGHT_PX = 120;

// Notes store HTML — escape the plain text and keep line breaks.
function noteHtmlFromText(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br />")}</p>`;
}

export type HolidayComposerVariant = "classic" | "note";

/**
 * "classic" is the inbox-style "Send | ⌄" message box (Enter sends). "note" is
 * the redesigned page's private-note box: a "Private to your team" header,
 * Ctrl/Cmd+Enter to submit and an "Add note" button.
 */
export function HolidayComposer({
  transactionId,
  variant = "classic",
}: {
  transactionId: string;
  variant?: HolidayComposerVariant;
}) {
  const isNote = variant === "note";
  const createMutation = useCreateNoteWithAttachments(transactionId);
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (createMutation.isPending) return;
    if (isNote && trimmed.length < 2) {
      toast({ title: "Write a note first.", variant: "destructive" });
      return;
    }
    if (!trimmed) return;
    createMutation.mutate(
      { data: { transaction_id: transactionId, content: noteHtmlFromText(trimmed) }, files: pendingFiles },
      {
        // Text and files clear together; on error neither is touched so the
        // user can retry without re-typing or re-picking.
        onSuccess: ({ uploadFailed }) => {
          setText("");
          setPendingFiles([]);
          toast(uploadFailed
            ? { title: isNote ? "Note added, but its attachments failed to upload" : "Message sent, but its attachments failed to upload", variant: "destructive" }
            : { title: isNote ? "Note added" : "Message sent" });
        },
        onError: () => toast({ title: isNote ? "Failed to add note" : "Failed to send message", variant: "destructive" }),
      },
    );
  };

  const handleFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { accepted, rejected } = filterNoteAttachmentFiles(Array.from(event.target.files ?? []), pendingFiles.length);
    // Reset so picking the same file again after removing it still fires onChange.
    event.target.value = "";
    rejected.forEach((title) => toast({ title, variant: "destructive" }));
    if (accepted.length > 0) setPendingFiles((prev) => [...prev, ...accepted]);
  };

  // Insert at the caret rather than appending, and hand focus back so typing
  // continues where the emoji landed — same pattern as the inbox Composer.
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  // Auto-grow driven off `text` so the box shrinks back after send clears it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [text]);

  return (
    <div className={isNote ? "mt-3" : "mt-4"} data-testid="holiday-detail-composer">
      <div className="rounded-[10px] border border-black/10 bg-white px-4 pt-3 pb-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        {isNote && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-qp-muted" data-testid="holiday-composer-private">
            <Lock className="h-3.5 w-3.5" /> Private to your team
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (isNote) {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={isNote ? "Write a note for your team…" : "Send a message about this holiday…"}
          rows={2}
          spellCheck
          lang="en-GB"
          className="min-h-[56px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="holiday-composer-input"
        />

        {pendingFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="holiday-composer-pending-attachments">
            {pendingFiles.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 bg-black/[0.02] px-2 py-1 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
              >
                <Paperclip className="h-3 w-3 shrink-0 text-black/40 dark:text-white/40" />
                <span className="max-w-[160px] truncate">{file.name}</span>
                <span className="text-black/40 dark:text-white/40">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                  title="Remove attachment"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 text-black/45 dark:text-white/45">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-[10px] transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                  title="Insert emoji"
                  data-testid="holiday-composer-emoji"
                >
                  <Smile className="h-4.5 w-4.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-72 rounded-[10px] p-2">
                <div className="max-h-[240px] space-y-2 overflow-y-auto" data-testid="holiday-composer-emoji-picker">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.name}>
                      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                        {cat.name}
                      </div>
                      <div className="grid grid-cols-8 gap-0.5">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="rounded-[10px] p-1 text-lg leading-none transition hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={NOTE_ATTACHMENT_ACCEPT}
              onChange={handleFilesPicked}
              className="hidden"
              data-testid="holiday-composer-attachment-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
              className="grid h-8 w-8 place-items-center rounded-[10px] transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
              data-testid="holiday-composer-attach"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
          </div>

          {isNote ? (
            <Button
              type="button"
              onClick={submit}
              disabled={!text.trim() || createMutation.isPending}
              className="h-10 shrink-0 gap-2 rounded-[10px] bg-social-navy px-4 text-sm font-semibold text-white hover:bg-social-navy-ink disabled:opacity-40"
              data-testid="holiday-composer-send"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add note"}
            </Button>
          ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={!text.trim() || createMutation.isPending}
            variant="outline"
            className="h-10 shrink-0 gap-2 rounded-[10px] border-black/10 bg-black/[0.02] px-4 text-sm font-medium text-black/60 hover:bg-black/5 hover:text-black disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
            data-testid="holiday-composer-send"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            <span className="h-4 w-px bg-black/15 dark:bg-white/15" aria-hidden />
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          )}
        </div>
      </div>
    </div>
  );
}
