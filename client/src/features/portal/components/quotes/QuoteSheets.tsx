import { useEffect, useReducer, useState } from "react";
import { PORTAL_DECLINE_REASONS } from "@shared/portal-quotes";
import { INITIAL_DECLINE_FORM, declineFormReducer } from "../../lib/quote-decision";
import { SHARE_METHOD, mailtoHref, shareMessage, shareNotice, shareUrl, smsHref, whatsAppHref } from "../../lib/quote-share";
import { PortalButton, portalButtonClass, ShareIcon } from "../brand";
import { PortalSheet } from "../PortalSheet";

const TEXT_AREA = "portal-textarea";

/** "Not interested": a reason (optional chips), a note (optional) and "send me something similar" (ticked). */
export function DeclineSheet({
  open,
  onOpenChange,
  quoteTitle,
  agent,
  pending,
  failed,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteTitle: string;
  agent: string;
  pending: boolean;
  failed: boolean;
  onSubmit: (input: { reason?: string; note?: string; wantsSimilar: boolean }) => void;
}) {
  const [form, dispatch] = useReducer(declineFormReducer, INITIAL_DECLINE_FORM);

  // A fresh form every time the sheet opens.
  useEffect(() => {
    if (open) dispatch({ type: "reset" });
  }, [open]);

  return (
    <PortalSheet
      open={open}
      onOpenChange={onOpenChange}
      label="Not interested"
      lead="Not quite"
      italic="right?"
      description={
        <>
          Tell {agent} what didn&apos;t work about <span className="font-normal text-foreground">{quoteTitle}</span> and they&apos;ll find something that suits you better. A reason is optional.
        </>
      }
      testId="sheet-decline"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <p className="portal-caps-label" id="decline-reasons-label">
            What&apos;s not right?
          </p>
          <div role="group" aria-labelledby="decline-reasons-label" className="flex flex-wrap gap-2">
            {PORTAL_DECLINE_REASONS.map((reason, i) => {
              const on = form.reason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  aria-pressed={on}
                  onClick={() => dispatch({ type: "reason", reason })}
                  className="portal-chip"
                  data-testid={`chip-reason-${i}`}
                >
                  {reason}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="decline-note" className="portal-caps-label">
            Anything else? (optional)
          </label>
          <textarea
            id="decline-note"
            rows={2}
            maxLength={1000}
            value={form.note}
            onChange={(e) => dispatch({ type: "note", note: e.target.value })}
            placeholder="Something under £3,000, or a week later"
            className={TEXT_AREA}
            data-testid="input-decline-note"
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-foreground">
          <input
            type="checkbox"
            checked={form.wantsSimilar}
            onChange={(e) => dispatch({ type: "similar", value: e.target.checked })}
            className="size-5 accent-[hsl(var(--primary))]"
            data-testid="check-similar"
          />
          Ask {agent} to send me something similar
        </label>

        {failed && (
          <p role="alert" className="portal-text-danger text-[13px]" data-testid="decline-error">
            That didn&apos;t send. Please try again.
          </p>
        )}

        <PortalButton
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() =>
            onSubmit({
              reason: form.reason || undefined,
              note: form.note.trim() || undefined,
              wantsSimilar: form.wantsSimilar,
            })
          }
          data-testid="button-decline-submit"
        >
          {pending ? "Sending" : `Tell ${agent}`}
        </PortalButton>
        <PortalButton variant="link" className="self-center" onClick={() => onOpenChange(false)}>
          Keep this quote
        </PortalButton>
      </div>
    </PortalSheet>
  );
}

/** Share: WhatsApp, text message, email, copy link, and the device's own share menu when it has one. */
export function ShareSheet({
  open,
  onOpenChange,
  title,
  dates,
  token,
  imageUrl,
  agencyName,
  agent,
  total,
  onShared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  dates: string;
  token: string;
  imageUrl: string;
  agencyName: string | null;
  agent: string;
  /** The quote's total as shown ("£3,177.46"), under its dates in the preview card. */
  total?: string;
  /** Called with the method name each time a share is started, so it can be recorded. */
  onShared: (method: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl(window.location.origin, token);
  const message = shareMessage({ title, dates, url, agencyName });

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // The clipboard can be blocked (an insecure page, a permission): the link is shown below to copy by hand.
    }
    setCopied(true);
    onShared(SHARE_METHOD.copy);
  }

  async function nativeShare() {
    onShared(SHARE_METHOD.native);
    try {
      await navigator.share({ title, text: message, url });
    } catch {
      // The customer closed the share menu.
    }
  }

  const link = "w-full";
  const small = (extra = "") => portalButtonClass("outline", `${link} ${extra}`.trim(), "sm");

  return (
    <PortalSheet
      open={open}
      onOpenChange={onOpenChange}
      label="Share this quote"
      lead="Ask what"
      italic="they think."
      testId="sheet-share"
    >
      <div className="flex flex-col gap-[22px]">
        <div className="flex items-center gap-3.5 border border-border bg-card p-3.5">
          {imageUrl && <img src={imageUrl} alt="" className="size-[88px] flex-none object-cover" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="portal-serif text-[19px] leading-[1.2] text-primary">{title}</span>
            {dates && <span className="text-[13px] text-muted-foreground">{dates}</span>}
            {total && <span className="portal-serif text-[19px] portal-text-ink">{total}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a href={whatsAppHref(message)} target="_blank" rel="noopener noreferrer" onClick={() => onShared(SHARE_METHOD.whatsapp)} className={small()} data-testid="share-whatsapp">
            WhatsApp
          </a>
          <a href={smsHref(message)} onClick={() => onShared(SHARE_METHOD.sms)} className={small()} data-testid="share-sms">
            Text message
          </a>
          <a href={mailtoHref("A holiday I'm looking at", message)} onClick={() => onShared(SHARE_METHOD.email)} className={small()} data-testid="share-email">
            Email
          </a>
          <button type="button" onClick={copy} className={small()} data-testid="button-copy-link">
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>

        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <PortalButton variant="link" className="self-center" onClick={nativeShare} data-testid="share-native">
<ShareIcon /> More options
          </PortalButton>
        )}

        {copied && (
          <p role="status" className="portal-text-amber-ink text-[13px]" data-testid="share-copied">
            Link copied. Paste it wherever you like.
          </p>
        )}
        <p className="text-[13px] leading-[1.6] text-muted-foreground">{shareNotice(agent)}</p>
        <p className="break-all text-[13px] text-muted-foreground" data-testid="share-url">
          {url}
        </p>
      </div>
    </PortalSheet>
  );
}
