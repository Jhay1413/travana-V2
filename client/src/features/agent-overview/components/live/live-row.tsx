import { Phone } from "lucide-react";
import type { Transaction } from "@/features/quote/types";
import { OperatorTile, getClientPhone, getTourOperator } from "@/features/pipeline";
import { PinToggleButton } from "@/components/shared/pin-toggle-button";
import type { PinnableDealType } from "@/hooks/use-deal-pin";
import { liveTitle, liveValueLabel } from "../../lib/live-value";
import { dealHref, resolveTabTarget, travelLineFor, type LiveTab, type TravelFields } from "../../lib/live-panel";
import { RowButton } from "../home/home-ui";

type DealWithNames = Transaction & { client_name?: string | null };

/** One Pipeline Live! row: operator tile, title + value, destination/dates, customer and phone, pin. */
export function LiveRow({
  deal,
  tab,
  pinned,
  onOpen,
  onTogglePin,
}: {
  deal: Transaction;
  tab: LiveTab;
  pinned: boolean;
  onOpen: (href: string) => void;
  onTogglePin: (type: PinnableDealType, id: string, label: string, subtitle: string) => void;
}) {
  const quote = deal.quotes?.[0];
  const location =
    quote?.destination_name || deal.booking?.destination_name || deal.enquiry?.destination_name || null;
  const operator = getTourOperator(deal);
  const value = liveValueLabel(deal, tab);
  const travelLine = travelLineFor(quote as TravelFields | undefined);
  const meta = [location, travelLine].filter(Boolean).join(" · ");
  const clientName = (deal as DealWithNames).client_name || deal.client?.name || null;
  const phone = getClientPhone(deal);
  const title = liveTitle(deal, tab);
  const pinTarget = resolveTabTarget(deal, tab);

  return (
    <RowButton
      onActivate={() => onOpen(dealHref(deal, tab))}
      className="flex items-start gap-3 rounded-none border-t border-social-border py-3.5 hover:bg-social-page"
      testId={`card-pipeline-live-${deal.id}`}
    >
      <OperatorTile name={operator.name} logoUrl={operator.logoUrl} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2.5">
          <b className="text-[13px] font-semibold leading-snug xl:text-[14px]">{title}</b>
          {value && (
            <span
              className="shrink-0 whitespace-nowrap text-[13px] font-semibold xl:text-[14px]"
              data-testid={`text-pipeline-live-value-${deal.id}`}
            >
              {value}
            </span>
          )}
        </div>
        {meta && <div className="my-0.5 text-[11px] text-social-muted xl:text-[12px]">{meta}</div>}
        {(clientName || phone || pinTarget) && (
          <div className="flex items-center gap-2 text-[11px] xl:text-[12px]">
            {clientName && <span className="min-w-0 truncate text-social-orange-text">{clientName}</span>}
            {phone && (
              <span className="flex shrink-0 items-center gap-1 text-social-muted">
                <Phone className="h-3 w-3" strokeWidth={2.2} />
                {phone}
              </span>
            )}
            <span className="flex-1" />
            {pinTarget && (
              <PinToggleButton
                pinned={pinned}
                onToggle={() =>
                  onTogglePin(
                    pinTarget.type,
                    pinTarget.id,
                    pinTarget.title || title,
                    [clientName, location].filter(Boolean).join(" · "),
                  )
                }
                data-testid={`button-pipeline-live-pin-${deal.id}`}
              />
            )}
          </div>
        )}
      </div>
    </RowButton>
  );
}
