import { useLocation } from "wouter";
import { Clock, ExternalLink, Phone, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeonClient, useTransaction } from "@/hooks/queries";
import { QuoteNotesSection } from "@/features/quote/components/QuoteNotesSection";
import { QuoteTasksSection } from "@/features/quote/components/QuoteTasksSection";
import type { Transaction } from "@/features/quote/types";
import {
  formatDate,
  formatCurrency,
  getAssigneeName,
  getTimeAgo,
  getTransactionNavUrl,
  getTransactionProfit,
  getTransactionValue,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";

const STAGE_HEX: Record<PipelineStage, string> = {
  Enquiry: "#3B82F6",
  Quoted: "#F59E0B",
  "In Play": "#8B5CF6",
  Booked: "#10B981",
  Future: "#0EA5E9",
  Lost: "#EF4444",
};

function getPax(t: Transaction): string {
  let a = 0, c = 0, i = 0;
  if (t.enquiry) { a = t.enquiry.adults || 0; c = t.enquiry.children || 0; i = t.enquiry.infants || 0; }
  else if (t.quotes?.[0]) { const q = t.quotes[0]; a = q.adult || 0; c = q.child || 0; i = q.infant || 0; }
  else if (t.booking) { a = t.booking.adult || 0; c = t.booking.child || 0; i = t.booking.infant || 0; }
  const p: string[] = [];
  if (a > 0) p.push(`${a}A`);
  if (c > 0) p.push(`${c}C`);
  if (i > 0) p.push(`${i}I`);
  return p.join(" ") || "—";
}

function getDest(t: Transaction): { dest: string; country: string } {
  const q0 = t.quotes?.[0];
  const bk = t.booking;
  const dest = q0?.destination_name || bk?.destination_name || t.enquiry?.destination_name || "TBC";
  return { dest: dest || "TBC", country: "" };
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-5 mb-2 flex items-center gap-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</h4>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

interface DetailPanelProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onClose: () => void;
}

/** Right-hand drawer with a quick summary + tasks/notes for the clicked deal.
 *  Behaviour is unchanged from the previous board — this is a straight move
 *  into its own file. */
export function TransactionDetailPanel({ transaction: t, stage, clientName, onClose }: DetailPanelProps) {
  const [, setLocation] = useLocation();
  const { data: client } = useNeonClient(t.client_id || "");
  const { data: fullTx } = useTransaction(t.id);
  const tx = fullTx || t;
  const value = getTransactionValue(t);
  const profit = getTransactionProfit(t);
  const { dest } = getDest(tx);
  const hex = STAGE_HEX[stage];
  const navUrl = getTransactionNavUrl(t, stage);

  // Notes are attached to the transaction; tasks are attached to the
  // stage-specific entity (enquiry / quote / booking), mirroring the
  // enquiry and quote detail pages.
  const mainQuote = t.quotes?.find((q) => !q.isQuoteCopy) || t.quotes?.[0];
  // Booking tasks are stored under entityType "quote" with the booking's id
  // (see holiday-detail-view.tsx's HolidayTasksTab / HolidayAddTaskDialog),
  // so a Booked card must match that instead of using "booking".
  const taskEntity: { type: "enquiry" | "quote"; id?: string; userId?: string } =
    stage === "Enquiry"
      ? { type: "enquiry", id: t.enquiry?.id, userId: t.enquiry?.user_id }
      : stage === "Booked"
        ? { type: "quote", id: t.booking?.id, userId: (t.booking as unknown as { user_id?: string } | undefined)?.user_id }
        : { type: "quote", id: mainQuote?.id, userId: (mainQuote as unknown as { user_id?: string } | undefined)?.user_id };

  return (
    <>
      <div className="fixed inset-0 z-[500] bg-black/20 transition-opacity" onClick={onClose} data-testid="panel-backdrop" />
      <div className="animate-in slide-in-from-right fixed bottom-0 right-0 top-0 z-[501] flex w-[560px] max-w-[90vw] flex-col border-l border-gray-200 bg-white shadow-2xl duration-300" data-testid="transaction-detail-panel">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{stage}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { onClose(); setLocation(navUrl); }} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100" data-testid="button-open-full">
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100" data-testid="button-close-panel">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="mb-0.5 text-lg font-bold text-gray-900">{clientName}</h3>
          {client?.phoneNumber && client.phoneNumber !== "NULL" && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm text-gray-600">{client.phoneNumber}</span>
            </div>
          )}

          <div className="mb-1 mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5">
              <span className="text-sm font-bold text-gray-900">{value > 0 ? formatCurrency(value) : "TBC"}</span>
            </div>
            {profit > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">{formatCurrency(profit)}</span>
              </div>
            )}
          </div>

          {(() => {
            const quote = tx.quotes?.find((q) => !q.isQuoteCopy) || tx.quotes?.[0];
            const booking = tx.booking;
            const enquiry = tx.enquiry;
            const title = quote?.title || booking?.title || enquiry?.title || null;
            const bookingAccommodations = (booking as unknown as { accommodations?: Array<Record<string, unknown>> } | undefined)?.accommodations;
            const accom = quote?.accommodations?.[0] || bookingAccommodations?.[0];
            const accomDest = (accom as { destination_name?: string } | undefined)?.destination_name || null;
            const accomResort = (accom as { resort_name?: string } | undefined)?.resort_name || null;
            const resort = accomDest || accomResort || (dest !== "TBC" ? dest : null);
            const costPP = quote?.price_per_person
              ? `£${parseFloat(quote.price_per_person).toLocaleString()}`
              : booking?.sales_price && getPax(tx)
                ? `£${Math.round(parseFloat(booking.sales_price) / parseInt(getPax(tx) || "1")).toLocaleString()}`
                : null;
            const hotel = (accom as { accomodation_name?: string } | undefined)?.accomodation_name || null;
            const roomType = (accom as { room_type_name?: string } | undefined)?.room_type_name || null;
            const boardBasis = (accom as { board_basis_name?: string } | undefined)?.board_basis_name || null;
            const pax = getPax(tx);
            const nights = quote?.num_of_nights?.toString() || booking?.num_of_nights?.toString() || enquiry?.no_of_nights?.toString() || null;
            const departure = formatDate(quote?.travel_date || booking?.travel_date || enquiry?.travel_date);
            const sectionTitle = booking ? "Booking Details" : quote ? "Quote Details" : "Enquiry Details";

            const cells: { label: string; val: string | null | undefined }[] = [
              { label: "Title", val: title },
              { label: "Resort", val: resort },
              { label: "Cost Per Person", val: costPP },
              { label: "Hotel", val: hotel },
              { label: "Room Type", val: roomType },
              { label: "Board Basis", val: boardBasis },
              { label: "Passengers", val: pax },
              { label: "Nights", val: nights },
              { label: "Departure", val: departure },
            ];

            return (
              <>
                <SectionHeader title={sectionTitle} />
                <div className="rounded-xl bg-gray-50 p-3.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {cells.map((c) => (
                      <div key={c.label}>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{c.label}</p>
                        <p className="mt-0.5 truncate text-[13px] font-semibold text-gray-800">{c.val || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          <SectionHeader title="Tasks" />
          {taskEntity.id ? (
            <QuoteTasksSection quoteId={taskEntity.id} entityType={taskEntity.type} assignedUserId={taskEntity.userId} className="!p-3" />
          ) : (
            <div className="rounded-xl bg-gray-50 p-3.5 text-center">
              <p className="text-[13px] text-gray-400">No tasks available for this deal</p>
            </div>
          )}

          <SectionHeader title="Notes" />
          <QuoteNotesSection transactionId={t.id} maxNotes={2} />

          <div className="mb-6 mt-4 flex items-center gap-2 text-[11px] text-gray-400">
            <Clock className="h-3 w-3" />
            <span>Last updated {getTimeAgo(tx.created_at)}</span>
            <span>·</span>
            <span>Agent: {getAssigneeName(tx)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3">
          <Button onClick={() => { onClose(); setLocation(navUrl); }} className="h-9 w-full rounded-xl bg-gray-900 text-sm font-medium text-white hover:bg-gray-800" data-testid="button-view-full-details">
            <ExternalLink className="mr-2 h-3.5 w-3.5" />View Full Details
          </Button>
        </div>
      </div>
    </>
  );
}
