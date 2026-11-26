import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useSubmitQuoteRequest } from "@/hooks/use-portal-api";
import { PortalButton } from "../brand";
import { PortalField } from "../PortalField";
import { PortalSheet } from "../PortalSheet";

const EMPTY_FORM = { destination: "", dates: "", travellers: "2", notes: "" };

/** "Request a quote": the same fields as ever; it is sent to the agent as a chat message, and the answer arrives in Messages. */
export function RequestQuoteSheet({ open, onOpenChange, agent }: { open: boolean; onOpenChange: (open: boolean) => void; agent: string }) {
  const [, setLocation] = useLocation();
  const request = useSubmitQuoteRequest();
  const [form, setForm] = useState(EMPTY_FORM);
  const [sent, setSent] = useState(false);
  const who = agent === "your agent" ? "Your agent" : agent;

  // A fresh form each time the sheet opens.
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setSent(false);
      request.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    request.mutate(form, { onSuccess: () => setSent(true) });
  };

  return (
    <PortalSheet
      open={open}
      onOpenChange={onOpenChange}
      label="Request a quote"
      lead="Where would you"
      italic="like to go?"
      description={sent ? undefined : `Tell ${who === "Your agent" ? "your agent" : who} a little about the holiday you have in mind.`}
      testId="sheet-request-quote"
    >
      {sent ? (
        <div className="flex flex-col gap-5 pb-2" data-testid="quote-request-sent">
          <p className="portal-serif text-[26px] leading-tight text-primary" data-testid="text-quote-request-success">
            Request sent.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{who} will reply in Messages.</p>
          <div className="grid grid-cols-2 gap-2">
            <PortalButton size="sm" onClick={() => setLocation("/portal/messages")} data-testid="button-quote-request-messages">
              Open Messages
            </PortalButton>
            <PortalButton variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="button-quote-request-close">
              Close
            </PortalButton>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-6">
          <PortalField
            id="request-destination"
            label="Destination"
            value={form.destination}
            onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
            placeholder="Where do you want to go?"
            required
            data-testid="input-destination"
          />
          <PortalField
            id="request-dates"
            label="Travel dates"
            value={form.dates}
            onChange={(e) => setForm((p) => ({ ...p, dates: e.target.value }))}
            placeholder="e.g. July 2027, 7 nights"
            data-testid="input-dates"
          />
          <PortalField
            id="request-travellers"
            label="Number of travellers"
            type="number"
            min="1"
            inputMode="numeric"
            value={form.travellers}
            onChange={(e) => setForm((p) => ({ ...p, travellers: e.target.value }))}
            data-testid="input-travellers"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="request-notes" className="portal-caps-label">
              Notes
            </label>
            <textarea
              id="request-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Anything else you'd like us to know?"
              rows={3}
              className="portal-serif w-full resize-none rounded-none border-0 border-b border-input bg-transparent px-0 py-2 text-[20px] text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none"
              data-testid="input-notes"
            />
          </div>
          {request.isError && (
            <p role="alert" className="portal-text-danger text-[13px]" data-testid="quote-request-error">
              That didn&apos;t send. Please try again.
            </p>
          )}
          <PortalButton type="submit" size="lg" className="w-full" disabled={request.isPending} data-testid="button-submit-quote-request">
            {request.isPending ? "Sending..." : "Send request"}
          </PortalButton>
        </form>
      )}
    </PortalSheet>
  );
}
