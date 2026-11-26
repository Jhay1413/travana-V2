import { useEffect, useRef, type KeyboardEvent } from "react";
import { canSend } from "../../lib/messages";
import { PortalButton } from "../brand";

/** The box pinned above the tab bar. Enter sends, Shift+Enter adds a line. */
export function MessageComposer({
  value,
  onChange,
  onSend,
  sending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the text, up to about four lines, then scroll inside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [value]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-border bg-background px-4 pb-3 pt-3" data-testid="message-composer">
      <div className="flex items-end gap-2">
        <label htmlFor="portal-message-input" className="sr-only">
          Your message
        </label>
        <textarea
          id="portal-message-input"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="min-h-12 max-h-28 min-w-0 flex-1 resize-none rounded-none border border-input bg-card px-3 py-3 portal-serif text-[22px] leading-snug text-foreground focus-visible:border-accent focus-visible:outline-none"
          data-testid="input-message"
        />
        <PortalButton
          onClick={onSend}
          disabled={!canSend(value, sending)}
          size="sm" className="px-5"
          aria-label={sending ? "Sending" : "Send message"}
          data-testid="button-send-message"
        >
          {sending ? "Sending" : "Send"}
        </PortalButton>
      </div>
    </div>
  );
}
