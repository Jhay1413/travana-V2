import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusPill } from "@/components/shared/status-pill";
import type { EnrichedBooking, EnrichedQuote, EnquiryTable } from "@/features/quote/types";
import type { HolidaySelection } from "@/features/client/types";
import { Breadcrumb } from "@/features/client/components/holiday/breadcrumb";
import { QuoteTopActions } from "@/features/client/components/holiday/quote-top-actions";
import { BookingTopActions, EnquiryTopActions } from "@/features/client/components/holiday/booking-enquiry-top-actions";

/**
 * Full-width header of the holiday detail page: avatar, breadcrumb, client name,
 * phone and badge pills, and the per-kind action row.
 *
 * Props:
 * - mode: which kind of holiday is shown; picks the action row and breadcrumb label.
 * - clientId / clientName / clientPhone / clientBadge: identity (badge e.g. "VIP Client" shows as a warn pill when set).
 * - selection: the selected deal ({ type, id }); id is used for pin / share / menus.
 * - quoteData / bookingData / enquiryData: the loaded detail for the matching mode. Until it arrives only the identity shows.
 * - readOnly: hides Share, Duplicate, Convert, assigned agent and the overflow menu. Pin stays; Preview stays only when a share token already exists.
 * - editOpen / onEditOpenChange: controlled state of the edit drawer owned by the overflow menu (Facts Edit sets it).
 * - onConvert: quote Convert to booking clicked; the page opens its ConvertDialog.
 * - onOpenExpiryDialog: opens the page's shared Update Expiry dialog (quote overflow menu).
 * - onDeleted: called after the deal is deleted so the page can clear the selection.
 */
export interface TopBarProps {
  mode: "quote" | "booking" | "enquiry";
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  clientBadge?: string | null;
  selection: HolidaySelection;
  quoteData?: EnrichedQuote;
  bookingData?: EnrichedBooking;
  enquiryData?: EnquiryTable;
  /** Booking mode: the linked quote and its share token (enables Preview). */
  sourceQuoteId?: string | null;
  sourceQuoteToken?: string | null;
  readOnly: boolean;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onConvert: () => void;
  onOpenExpiryDialog: (dateExpiry: string | Date | null | undefined) => void;
  onDeleted: () => void;
}

const KIND_LABEL = { quote: "Quote", booking: "Booking", enquiry: "Enquiry" } as const;

export function TopBar({
  mode,
  clientId,
  clientName,
  clientPhone,
  clientBadge,
  selection,
  quoteData,
  bookingData,
  enquiryData,
  sourceQuoteId,
  sourceQuoteToken,
  readOnly,
  editOpen,
  onEditOpenChange,
  onConvert,
  onOpenExpiryDialog,
  onDeleted,
}: TopBarProps) {
  const common = { clientId, clientName, readOnly, editOpen, onEditOpenChange, onDeleted };
  return (
    <TooltipProvider>
      <header
        className="col-span-full flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-social-border bg-card px-[18px] py-3.5"
        data-testid="holiday-top-bar"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <PersonAvatar name={clientName} size={44} dark />
          <div className="min-w-0">
            <Breadcrumb clientId={clientId} clientName={clientName} kind={KIND_LABEL[mode]} />
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold leading-tight">{clientName}</h1>
              {clientPhone ? (
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-avatar-violet-bg px-3 py-[3px] text-[12px] font-semibold text-avatar-violet-fg">
                  {clientPhone}
                </span>
              ) : null}
              {clientBadge ? <StatusPill tone="warn">{clientBadge}</StatusPill> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="holiday-top-actions">
          {mode === "quote" && quoteData && (
            <QuoteTopActions
              key={selection.id}
              quoteId={selection.id}
              quoteData={quoteData}
              clientPhone={clientPhone}
              onConvert={onConvert}
              onOpenExpiryDialog={onOpenExpiryDialog}
              {...common}
            />
          )}
          {mode === "booking" && bookingData && <BookingTopActions bookingId={selection.id} bookingData={bookingData} sourceQuoteId={sourceQuoteId} sourceQuoteToken={sourceQuoteToken} {...common} />}
          {mode === "enquiry" && enquiryData && <EnquiryTopActions enquiryId={selection.id} enquiryData={enquiryData} {...common} />}
        </div>
      </header>
    </TooltipProvider>
  );
}
