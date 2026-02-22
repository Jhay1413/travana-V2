import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  ChevronRight,
  Pencil,
  Pin,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { EnquiryTable } from "@/types/quote";
import type { Favorite } from "@/api/endpoints/favorite.api";
import type { Client } from "./client-types";

interface ClientEnquiriesTabProps {
  enquiries: EnquiryTable[];
  isLoadingTransactions: boolean;
  clientId: string;
  navigate: (to: string) => void;
  client: Client | null;
  userFavorites: Favorite[] | undefined;
  toggleFavoriteMutation: { mutate: (args: { itemType: string; itemId: string; label: string; subtitle: string }) => void };
  onConvertEnquiryToQuote: (enq: EnquiryTable) => void;
  onEditEnquiry: (enq: EnquiryTable) => void;
  onNewEnquiry: () => void;
  onDeleteEnquiry: (id: string) => void;
}

export function ClientEnquiriesTab({
  enquiries,
  isLoadingTransactions,
  clientId,
  navigate,
  client,
  userFavorites,
  toggleFavoriteMutation,
  onConvertEnquiryToQuote,
  onEditEnquiry,
  onNewEnquiry,
  onDeleteEnquiry,
}: ClientEnquiriesTabProps) {
  return (
    <div className="grid gap-3" data-testid="list-enquiries">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Enquiries</div>
        <Button
          size="sm"
          className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
          data-testid="button-new-enquiry"
          onClick={onNewEnquiry}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          New Enquiry
        </Button>
      </div>
      {isLoadingTransactions ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : enquiries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-white/40 p-8 text-center text-sm text-black/50" data-testid="empty-enquiries">
          No enquiries yet. Create one to get started.
        </div>
      ) : (
        enquiries.map((enq: EnquiryTable, idx: number) => (
          <motion.div
            key={enq.id}
            className="group cursor-pointer rounded-3xl border border-black/10 bg-white/70 p-4 transition hover:bg-black/[0.02] active:scale-[0.99]"
            data-testid={`card-enquiry-${idx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18) }}
            onClick={() => navigate(`/clients/${clientId}/enquiries/${enq.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold" data-testid={`text-enquiry-title-${idx}`}>
                    {enq.title}
                  </div>
                  {enq.status === "Converted" && (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Converted</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid={`text-enquiry-meta-${idx}`}>
                  {enq.holiday_type_name && (
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/70">
                      {enq.holiday_type_name}
                    </span>
                  )}
                  {enq.destinations?.[0]?.name && <span>{enq.destinations[0].name}</span>}
                  {enq.travel_date && <span>· {new Date(enq.travel_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                  <span>· {enq.adults || 0}A{(enq.children || 0) > 0 ? ` ${enq.children}C` : ""}{(enq.infants || 0) > 0 ? ` ${enq.infants}I` : ""}</span>
                  {enq.no_of_nights && <span>· {enq.no_of_nights}N</span>}
                  {enq.budget && <span>· £{parseFloat(enq.budget).toLocaleString()} {enq.budget_type?.toLowerCase()}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  role="button"
                  tabIndex={0}
                  className={`grid h-7 w-7 place-items-center rounded-full transition ${userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enq.id) ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"}`}
                  data-testid={`button-pin-enquiry-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteMutation.mutate({ itemType: "enquiry", itemId: enq.id, label: enq.title || "", subtitle: `${client?.name || ""}${enq.destinations?.[0]?.name ? " · " + enq.destinations[0].name : enq.holiday_type_name ? " · " + enq.holiday_type_name : ""}` });
                  }}
                  title={userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enq.id) ? "Unpin" : "Pin to dashboard"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </span>
                {enq.status !== "Converted" && (
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-emerald-50 hover:text-emerald-600"
                    data-testid={`button-convert-enquiry-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onConvertEnquiryToQuote(enq);
                    }}
                    title="Convert to Quote"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-black/[0.05] hover:text-black/70"
                  data-testid={`button-edit-enquiry-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditEnquiry(enq);
                  }}
                  title="Edit enquiry"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-red-50 hover:text-red-500"
                  data-testid={`button-delete-enquiry-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEnquiry(enq.id);
                  }}
                  title="Delete enquiry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="ml-1 h-4 w-4 text-black/30 transition group-hover:translate-x-0.5" />
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}
