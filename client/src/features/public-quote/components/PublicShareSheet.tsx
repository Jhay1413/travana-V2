import { useEffect, useState } from "react";
import { customerOrigin } from "@/config/env";
import { PortalButton, ShareIcon, portalButtonClass } from "@/features/portal";
import { PortalSheet } from "@/features/portal/components/PortalSheet";
import { SHARE_METHOD, mailtoHref, shareMessage, shareUrl, smsHref, whatsAppHref } from "@/features/portal/lib/quote-share";
import type { ShareMethod } from "@/features/quote/api/use-quote-public-queries";

/**
 * The design's Share sheet for a visitor: WhatsApp, text message, email, copy link and the device's own share menu.
 * Built on the portal's sheet; the portal's own ShareSheet is not reused because its closing note ("Only you can tell
 * your agent you're interested") is about a signed-in customer. The link is always the plain public address built from
 * the token, so the staff-only `?preview=1` can never be shared.
 */
export function PublicShareSheet({
  open,
  onOpenChange,
  title,
  dates,
  token,
  imageUrl,
  total,
  agencyName,
  onShared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  dates: string;
  token: string;
  imageUrl: string;
  total: string;
  agencyName: string | null;
  /** Called each time a share is started with the name the server records; the page decides whether to record it. */
  onShared: (method: ShareMethod) => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl(customerOrigin(window.location.origin), token);
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
      // The visitor closed the share menu.
    }
  }

  const small = portalButtonClass("outline", "w-full", "sm");

  return (
    <PortalSheet open={open} onOpenChange={onOpenChange} label="Share this quote" lead="Ask what" italic="they think." testId="sheet-share">
      <div className="flex flex-col gap-[22px]">
        <div className="flex items-center gap-3.5 border border-border bg-card p-3.5">
          {imageUrl && <img src={imageUrl} alt="" className="size-[88px] flex-none object-cover" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">
            <span className="portal-serif text-[19px] leading-[1.2] text-primary">{title}</span>
            {dates && <span className="text-[13px] text-muted-foreground">{dates}</span>}
            {total && <span className="portal-serif text-[19px] portal-text-ink">{total}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a href={whatsAppHref(message)} target="_blank" rel="noopener noreferrer" onClick={() => onShared(SHARE_METHOD.whatsapp)} className={small} data-testid="share-whatsapp">
            WhatsApp
          </a>
          <a href={smsHref(message)} onClick={() => onShared(SHARE_METHOD.sms)} className={small} data-testid="share-sms">
            Text message
          </a>
          <a href={mailtoHref("A holiday I'm looking at", message)} onClick={() => onShared(SHARE_METHOD.email)} className={small} data-testid="share-email">
            Email
          </a>
          <button type="button" onClick={copy} className={small} data-testid="button-copy-link">
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
        <p className="text-[13px] leading-[1.6] text-muted-foreground">Anyone with the link can see the photos, the itinerary and the price.</p>
        <p className="break-all text-[13px] text-muted-foreground" data-testid="share-url">
          {url}
        </p>
      </div>
    </PortalSheet>
  );
}
