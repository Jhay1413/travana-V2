import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ChevronLeft,
  Copy,
  Ellipsis,
  Eye,
  FileText,
  Pencil,
  PinOff,
  Pin,
  Search,
  Trash2,
  TreePalm,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import { useDeleteQuote } from "@/hooks/mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import { useQuote, useCurrentUser } from "@/hooks/queries";
import { StatusPill } from "@/features/social/components/social-quote";
import { transformQuoteData, currency, formatUKDate } from "@/features/quote/components/quote-types";
import { QuoteGuruSheet } from "@/features/quote/components/QuoteGuruSheet";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { QuoteEditDialog } from "@/features/quote/components/quote-edit-dialog";
import { QuoteExpiryDialog } from "@/features/quote/components/QuoteExpiryDialog";
import { useNeonClients } from "@/features/client/api/use-neon-client-queries";
import type { NeonClient } from "@/features/client/types/neon-client/neon-client.types";
import { normalizeTransferType } from "@/features/quote/types/quote-form.types";
import { useQuoteImages, useQuoteGuru, useQuoteExpiry } from "@/features/quote/components/hooks";
import { HolidayDetailView, HEADER_ELLIPSIS_BUTTON_CLASS } from "@/features/client/components/holiday-detail-view";
import { HolidayDetailsPanel } from "@/features/client/components/holiday-details-panel";
import { CircleAction } from "@/features/client/components/circle-action";

export default function SocialQuotePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/social-posts/quotes/:quoteId");

  const { role } = useRole();
  const quoteId = params?.quoteId ?? "";

  const quoteQuery = useQuote(quoteId);
  const { data: rawData, isLoading, error } = quoteQuery;

  const quote = useMemo(() => (rawData ? transformQuoteData(rawData) : null), [rawData]);

  // Only the copy flow's initialImages still needs this — gallery display/
  // editing now lives inside HolidayDetailView's own hero card.
  const { quoteImageUrls } = useQuoteImages(rawData);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const isFavorited = useMemo(
    () => userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === quoteId) ?? false,
    [userFavorites, quoteId]
  );
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<NeonClient | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const { data: clientResults, isLoading: clientsLoading } = useNeonClients(
    showClientPicker ? { search: clientSearch, limit: 10 } : undefined
  );

  const {
    showGuruSheet, setShowGuruSheet,
    guruDestination, guruRecord, generateGuruMutation,
  } = useQuoteGuru(quote, rawData);

  // Single shared "Update Expiry" dialog for this quote — mirrors the client
  // page's pattern (see pages/client/index.tsx) so the expired-banner button
  // inside the deal-view body and any future trigger here share one dialog.
  const quoteExpiry = useQuoteExpiry(quoteId);

  const deleteQuoteMutation = useDeleteQuote();

  // Free social quotes are created on their own client-less transaction (see
  // newQuoteService.createSocialQuote), so client_id is typically absent —
  // fall back to "" the same way a client-less holiday flows through the
  // deal-view components. "Social Posts" doubles as the breadcrumb label and
  // its click target (back to this page), mirroring the back button above.
  const clientId = rawData?.client_id ?? "";
  const clientName = "Social Posts";

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-social-quote">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-social-quote">
        <div className="text-center">
          <p className="text-sm text-black/70">Failed to load quote</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => setLocation("/social-posts")}
          >
            Back to Social Posts
          </Button>
        </div>
      </div>
    );
  }

  function handleTogglePin() {
    if (!quote) return;
    toggleFavoriteMutation.mutate(
      {
        itemType: "quote",
        itemId: quoteId,
        label: quote.quoteTitle,
        subtitle: quote.destinationName ? ` · ${quote.destinationName}` : "",
      },
      {
        onSuccess: (data: { favorited?: boolean }) => {
          toast({
            title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard",
          });
        },
      }
    );
  }

  async function handleConfirmDelete() {
    try {
      await deleteQuoteMutation.mutateAsync(quoteId);
      toast({ title: "Quote deleted" });
      setLocation("/social-posts");
    } catch {
      toast({ title: "Failed to delete quote", variant: "destructive" });
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <section
        className="text-compact -m-4 grid h-[calc(100vh-3.5rem)] grid-cols-1 gap-0 overflow-hidden rounded-tl-lg md:-m-6 lg:grid-cols-[1fr_240px] xl:grid-cols-[1fr_300px] 3xl:grid-cols-[1fr_380px]"
        data-testid="page-social-quote"
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Header */}
          <div
            className="shrink-0 flex flex-col gap-3 px-5 pb-4 pt-5 md:flex-row md:items-start md:justify-between"
            data-testid="row-social-quote-header"
          >
            <div className="flex items-start gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-2xl border-black/10 bg-white/70"
                data-testid="button-back-social-posts"
                onClick={() => setLocation("/social-posts")}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Social Posts
              </Button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold" data-testid="text-social-quote-title">
                    {quote.quoteTitle},{" "}
                    <span className="text-sm font-semibold text-[#000000]">
                      {currency.format(quote.pricePerPerson)}pp
                    </span>
                  </div>
                  <StatusPill status={quote.status} />
                </div>
                <div
                  className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55"
                  data-testid="text-social-quote-meta"
                >
                  <span data-testid="text-social-quote-meta-destination">{quote.destinationName || quote.destination}</span>
                  <span className="text-black/25">•</span>
                  <span data-testid="text-social-quote-meta-dates">
                    {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                  </span>
                  <span className="text-black/25">•</span>
                  <span data-testid="text-social-quote-meta-created">
                    Created {formatUKDate(quote.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2" data-testid="row-social-quote-actions">
              {rawData?.quote_ref && (
                <CircleAction icon={Eye} label="View Quote" href={rawData.quote_ref} testId="link-view-social-quote" />
              )}
              <CircleAction
                icon={TreePalm}
                label="Destination Guru"
                onClick={() => setShowGuruSheet(true)}
                testId="button-destination-guru-social-quote"
              />
              <CircleAction
                icon={Copy}
                label="Copy to client"
                onClick={() => {
                  setSelectedClient(null);
                  setClientSearch("");
                  setShowClientPicker(true);
                }}
                testId="button-copy-social-quote"
              />
              <CircleAction icon={FileText} label="Export" onClick={() => {}} testId="button-export-social-quote" />
              <CircleAction
                icon={isFavorited ? PinOff : Pin}
                label={isFavorited ? "Unpin" : "Pin"}
                onClick={handleTogglePin}
                active={isFavorited}
                testId="button-pin-social-quote"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={HEADER_ELLIPSIS_BUTTON_CLASS}
                    aria-label="More actions"
                    data-testid="button-more-social-quote-actions"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  <DropdownMenuItem
                    onClick={() => setShowEditDialog(true)}
                    className="gap-2 rounded-lg text-sm"
                    data-testid="button-edit-social-quote"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2 rounded-lg text-sm text-red-600 focus:bg-red-50 focus:text-red-600"
                    data-testid="button-delete-social-quote"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Main Content — the client details deal view's centre body */}
          <div
            className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 pb-8"
            data-testid="layout-social-quote-body"
          >
            <HolidayDetailView
              clientId={clientId}
              clientName={clientName}
              selection={{ type: "quote", id: quoteId }}
              onBack={() => setLocation("/social-posts")}
              onOpenExpiryDialog={quoteExpiry.openExpiryDialog}
              showDetailTabs={false}
            />
          </div>
        </div>

        <HolidayDetailsPanel
          className="hidden lg:flex"
          selection={{ type: "quote", id: quoteId }}
          enquiries={[]}
          quotes={rawData ? [rawData] : []}
          bookings={[]}
        />
      </section>

      <QuoteEditDialog
        quoteId={quoteId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        presentation="drawer"
        onSuccess={() => {
          setShowEditDialog(false);
          queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });
        }}
      />

      <QuoteGuruSheet
        open={showGuruSheet}
        onOpenChange={setShowGuruSheet}
        guruDestination={guruDestination}
        guruRecord={guruRecord as any}
        generateGuruMutation={generateGuruMutation}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="button-delete-social-quote-cancel"
              disabled={deleteQuoteMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-delete-social-quote-confirm"
              disabled={deleteQuoteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteQuoteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuoteExpiryDialog
        open={quoteExpiry.showExpiryDialog}
        onOpenChange={quoteExpiry.setShowExpiryDialog}
        expiryDate={quoteExpiry.expiryDate}
        onExpiryDateChange={quoteExpiry.setExpiryDate}
        isPending={quoteExpiry.updateQuoteExpiryMutation.isPending}
        onConfirm={quoteExpiry.confirmExpiry}
      />

      {/* Client picker — step 1 of copy flow */}
      <Dialog open={showClientPicker} onOpenChange={(open) => { if (!open) { setShowClientPicker(false); setClientSearch(""); } }}>
        <DialogContent className="max-w-md rounded-3xl border-black/10 bg-white/95 p-6 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Copy to client</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              Search and select the client this quote will be copied to.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <Input
              autoFocus
              placeholder="Search by name or email…"
              className="h-9 rounded-xl border-black/10 bg-white/70 pl-9 text-sm"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-black/10">
            {clientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (clientResults?.clients ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-black/40">
                {clientSearch ? "No clients found" : "Start typing to search"}
              </p>
            ) : (
              (clientResults?.clients ?? []).map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition last:border-0 hover:bg-black/[0.03]"
                  onClick={() => {
                    setSelectedClient(client);
                    setShowClientPicker(false);
                    setShowCreateDialog(true);
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-semibold text-black/60">
                    {client.firstName?.[0]}{client.surename?.[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{client.firstName} {client.surename}</div>
                    {client.email && <div className="truncate text-xs text-black/45">{client.email}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {rawData && selectedClient && (() => {
        const splitDT = (iso: string | undefined | null) => {
          if (!iso) return { date: "", time: "" };
          const t = iso.indexOf("T");
          return t === -1
            ? { date: iso, time: "" }
            : { date: iso.substring(0, t), time: iso.substring(t + 1).substring(0, 5) };
        };

        const flights = rawData.flights || [];
        const outboundFlights = flights
          .filter((f) => f.flight_type === "outbound")
          .sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
        const inboundFlights = flights
          .filter((f) => f.flight_type === "inbound")
          .sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
        const outbound = outboundFlights[0];
        const inbound = inboundFlights[0];

        const accommodations = rawData.accommodations || [];
        const primaryAccom = accommodations.find((a) => a.is_primary) || accommodations[0];

        const outDep = splitDT(outbound?.departure_date_time);
        const outArr = splitDT(outbound?.arrival_date_time);
        const inDep = splitDT(inbound?.departure_date_time);
        const inArr = splitDT(inbound?.arrival_date_time);
        const checkIn = splitDT(primaryAccom?.check_in_date_time);

        return (
          <QuoteCreateDialog
            open={showCreateDialog}
            onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setSelectedClient(null); } }}
            clientId={selectedClient.id}
            userId={currentUser?.id || ""}
            markAsCopy={false}
            initialImages={quoteImageUrls}
            initialValues={{
              packageType: rawData.holiday_type_id || "",
              quoteTitle: rawData.title || "",
              // The supplier link the post was built from — the client's copy is
              // worked from the same page, so it has to come across too.
              quoteLink: rawData.quote_ref || "",
              leadSource: rawData.lead_source || "",
              status: rawData.quote_status || "draft",
              tourOperatorId: rawData.main_tour_operator_id || "",
              travelDate: rawData.travel_date?.toString().split("T")[0] || "",
              nights: rawData.num_of_nights || 7,
              passengersAdults: rawData.adult || 2,
              passengersChildren: rawData.child || 0,
              passengersInfants: rawData.infant || 0,
              transferType: normalizeTransferType(rawData.transfer_type),
              preBookedSeats: rawData.pre_booked_seats || "",
              flightMeals: rawData.flight_meals ? "Yes" : "",
              country: rawData.country_id || "",
              destination: rawData.destination_id || "",
              resort: rawData.resort_id || "",
              accommodationId: primaryAccom?.accomodation_id || "",
              boardBasisId: primaryAccom?.board_basis_id || "",
              checkInDate: checkIn.date,
              checkInTime: checkIn.time,
              roomType: primaryAccom?.room_type || "",
              outboundDepartAirportId: outbound?.departing_airport_id || "",
              outboundArriveAirportId: outbound?.arrival_airport_id || "",
              outboundDepartDate: outDep.date,
              outboundDepartTime: outDep.time,
              outboundArriveDate: outArr.date,
              outboundArriveTime: outArr.time,
              outboundFlightNumber: outbound?.flight_number || "",
              outboundConnectingLegs: outboundFlights.slice(1).map((f) => {
                const dep = splitDT(f.departure_date_time);
                const arr = splitDT(f.arrival_date_time);
                return {
                  departAirportId: f.departing_airport_id || "",
                  departAirport: "",
                  arriveAirportId: f.arrival_airport_id || "",
                  arriveAirport: "",
                  departDate: dep.date,
                  departTime: dep.time,
                  arriveDate: arr.date,
                  arriveTime: arr.time,
                  flightNumber: f.flight_number || "",
                };
              }),
              inboundDepartAirportId: inbound?.departing_airport_id || "",
              inboundArriveAirportId: inbound?.arrival_airport_id || "",
              inboundDepartDate: inDep.date,
              inboundDepartTime: inDep.time,
              inboundArriveDate: inArr.date,
              inboundArriveTime: inArr.time,
              inboundFlightNumber: inbound?.flight_number || "",
              inboundConnectingLegs: inboundFlights.slice(1).map((f) => {
                const dep = splitDT(f.departure_date_time);
                const arr = splitDT(f.arrival_date_time);
                return {
                  departAirportId: f.departing_airport_id || "",
                  departAirport: "",
                  arriveAirportId: f.arrival_airport_id || "",
                  arriveAirport: "",
                  departDate: dep.date,
                  departTime: dep.time,
                  arriveDate: arr.date,
                  arriveTime: arr.time,
                  flightNumber: f.flight_number || "",
                };
              }),
              parkId: rawData.park_id || "",
              lodgeId: rawData.lodge_id || "",
              pets: rawData.pets ?? 0,
              price: parseFloat(String(rawData.sales_price || 0)) || 0,
              commission: parseFloat(String(rawData.package_commission || 0)) || 0,
              discount: parseFloat(String(rawData.discounts || 0)) || 0,
              serviceCharge: parseFloat(String(rawData.service_charge || 0)) || 0,
              pricePerPerson: parseFloat(String(rawData.price_per_person || 0)) || 0,
            }}
          />
        );
      })()}
    </>
  );
}
