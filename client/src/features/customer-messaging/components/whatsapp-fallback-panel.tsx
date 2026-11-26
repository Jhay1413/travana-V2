import { Button } from "@/components/ui/button";
import { whatsAppLink } from "@/features/conversations";
import type { WhatsappFallback, WhatsappFallbackReason } from "../types";

const COPY: Record<WhatsappFallbackReason, string> = {
  not_allowed: "WhatsApp can't be sent from this app for your account, so send it from your own WhatsApp.",
  not_configured: "WhatsApp isn't connected for your agency, so send it from your own WhatsApp.",
  no_contact: "There is no approved template or open chat for this customer, so send it from your own WhatsApp.",
  no_channel: "No active WhatsApp number is connected for your agency, so send it from your own WhatsApp.",
  window_closed: "The customer hasn't messaged in the last 24 hours, so send it from your own WhatsApp.",
  template_failed: "The WhatsApp template couldn't be sent, so send it from your own WhatsApp.",
};

/**
 * The "Open in WhatsApp" hand-over, for a message the system could not send through the agency's inbox. The text (and any
 * one-time link inside it) appears only inside the wa.me address of the button, never on screen.
 */
export function WhatsappFallbackPanel({ fallback, phone, onOpened, testId = "whatsapp-fallback" }: { fallback: WhatsappFallback; phone: string | null | undefined; onOpened?: () => void; testId?: string }) {
  const base = whatsAppLink(phone);
  const href = base ? `${base}?text=${encodeURIComponent(fallback.text)}` : null;
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid={testId}>
      <p>{COPY[fallback.reason]}</p>
      {href ? (
        <Button asChild size="sm" variant="outline" className="h-8 rounded-xl px-3" data-testid={`${testId}-open`}>
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={onOpened} onAuxClick={onOpened}>
            Open in WhatsApp
          </a>
        </Button>
      ) : (
        <p className="text-amber-800/80">This customer has no valid phone number on file, so WhatsApp can't be opened.</p>
      )}
    </div>
  );
}
