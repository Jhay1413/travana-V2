import { Eyebrow, PortalButton, PortalSection, SplitHeading } from "../brand";

/**
 * PLACEHOLDER behind the `VITE_PORTAL_PAYMENTS` flag (off by default: nothing is rendered). What a customer owes
 * and when is undecided, so this shows no figure, no progress and no date: it only says the agent will confirm
 * them. Do not derive anything here from the booking (in particular not from the operator's balance terms).
 */
export function BookingPayments({ enabled, agent, onAsk }: { enabled: boolean; agent: string; onAsk: () => void }) {
  if (!enabled) return null;
  const who = agent === "your agent" ? "Your agent" : agent;
  return (
    <PortalSection aria-labelledby="booking-payments" className="pt-16" data-testid="booking-payments">
      <Eyebrow className="mb-3.5">Payments</Eyebrow>
      <SplitHeading id="booking-payments" lead="Balance and" italic="dates." className="mb-4" />
      <p className="text-[15px] leading-[1.7] text-muted-foreground">{who} will confirm your balance and payment dates with you.</p>
      <PortalButton variant="outline" className="mt-5 w-full" onClick={onAsk} data-testid="button-payments-message">
        {agent === "your agent" ? "Message your agent" : `Message ${agent}`}
      </PortalButton>
    </PortalSection>
  );
}
