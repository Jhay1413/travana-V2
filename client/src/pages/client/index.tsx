import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useNeonClient,
  useTransactions,
  useTicketsByClient,
  useUsers,
  useCurrentUser,
  useTasks,
  transactionKeys,
} from "@/hooks/queries";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import type { Transaction, EnquiryTable } from "@/features/quote/types";
import { buildQuoteInitialValuesFromEnquiry } from "@/features/quote/lib/enquiry-to-quote";
import { enquiryApi } from "@/api";
import { enquiryKeys } from "@/features/enquiry/api/use-enquiry-queries";
import { useQueryClient } from "@tanstack/react-query";
import type { QuoteFormValues } from "@/features/quote/types/quote-form.types";
import { useToast } from "@/hooks/use-toast";
import { EnquiryWizard } from "@/features/enquiry/components/enquiry-wizard";

import { transformNeonClientData } from "@/features/client/components/client-types";
import { MergeClientDialog } from "@/features/client/components/modals/MergeClientDialog";
import { UploadFileDialog } from "@/features/client/components/modals/UploadFileDialog";
import { AllHolidaysPanel } from "@/features/client/components/all-holidays-panel";
import { HolidayDetailsPanel } from "@/features/client/components/holiday-details-panel";
import { HolidayDetailView } from "@/features/client/components/holiday-detail-view";
import { HolidayHeaderActions } from "@/features/client/components/holiday-header-actions";
import { useQuoteExpiry } from "@/features/quote/components/hooks";
import { QuoteExpiryDialog } from "@/features/quote/components/QuoteExpiryDialog";
import { ClientPageHeader } from "@/features/client/components/page/client-page-header";
import { ClientStatBoxes } from "@/features/client/components/page/client-stat-boxes";
import { ClientDashboardCard } from "@/features/client/components/page/client-dashboard-card";
import { PortalAccessCard, ReferralNetworkCard, ReferredByCard } from "@/features/client/components/page/side-cards";
import { LiveDealsRail } from "@/features/client/components/page/live-deals-rail";
import { useLiveDealsState } from "@/features/client/components/page/use-live-deals-state";
import { EditClientModal } from "@/features/client/components/page/modals/edit-client-modal";
import { ReferrerModal } from "@/features/client/components/page/modals/referrer-modal";
import { PortalPinModal } from "@/features/client/components/page/modals/portal-pin-modal";
import { ShareClientModal } from "@/features/client/components/page/modals/share-client-modal";
import { computeClientStats } from "@/features/client/lib/client-stats";
import { isClientReadOnly } from "@/features/client/lib/client-access";
import { buildDealLabels, buildTaskHolidays } from "@/features/client/lib/deal-labels";
import type { ClientCreateKind, HolidaySelection } from "@/features/client/types";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { BookingCreateDialog } from "@/features/booking/components/booking-create-dialog";
import { CreateTaskDialog } from "@/features/tasks/components/tasks/CreateTaskDialog";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import {
  useClientEditForm,
  useClientFiles,
  useClientTaskCreate,
  useClientTicketCreate,
  useClientEnquiryActions,
} from "@/features/client/components/hooks";

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const search = useSearch();
  const { toast } = useToast();

  const { role, orgRole } = useRole();
  const readOnly = isClientReadOnly(orgRole);
  const [showReferrerModal, setShowReferrerModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Rail view state lives here so it survives opening a deal and coming back.
  const liveDealsState = useLiveDealsState();
  const [showQuoteCreateDialog, setShowQuoteCreateDialog] = useState(false);
  const [showBookingCreateDialog, setShowBookingCreateDialog] = useState(false);
  const [convertingFromEnquiryTxnId, setConvertingFromEnquiryTxnId] = useState<string | null>(null);
  const [convertingEnquiryId, setConvertingEnquiryId] = useState<string | null>(null);
  const [convertingEnquiryInitialValues, setConvertingEnquiryInitialValues] = useState<Partial<QuoteFormValues> | undefined>(undefined);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [holidaySelection, setHolidaySelection] = useState<HolidaySelection | null>(null);
  const clientId = params?.clientId ?? "";

  // Single shared "Update Expiry" dialog for the selected quote — both the
  // header's action menu and the hero card's expired-banner button open it,
  // but only one instance is ever mounted (avoids duplicate dialog/testid
  // DOM nodes). Harmless to construct with an empty id when nothing/a
  // non-quote is selected: the mutation only fires once the dialog is open
  // and confirmed, which only ever happens via a quote's own trigger.
  const quoteExpiry = useQuoteExpiry(holidaySelection?.type === "quote" ? holidaySelection.id : "");

  const { data: clientData, isLoading: isLoadingClient } = useNeonClient(clientId);
  // The overview stats and Live Deals list come from this query, so it must
  // reflect a deal created moments ago — even when the page was left and
  // re-entered inside the 30s default stale window.
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({ clientId }, { staleTime: 0, refetchOnMount: "always" });
  const { data: ticketsData } = useTicketsByClient(clientId);
  const { data: tasksData } = useTasks("client", clientId);
  const { data: usersData } = useUsers();
  const { data: currentUser } = useCurrentUser();

  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const queryClient = useQueryClient();

  const editForm = useClientEditForm(clientId, clientData);
  const fileActions = useClientFiles(clientId);
  const taskCreate = useClientTaskCreate();
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id);
  const enquiryActions = useClientEnquiryActions(clientId, currentUser?.id, () => {
    setConvertingFromEnquiryTxnId(null);
    setConvertingEnquiryId(null);
  });

  // ?create=enquiry|quote|booking|task|ticket opens that dialog once. It waits
  // for the current user (so the role is known) and never fires for a
  // read-only role.
  const createHandled = useRef(false);
  useEffect(() => {
    if (createHandled.current || !currentUser) return;
    createHandled.current = true;
    if (readOnly) return;
    const create = new URLSearchParams(window.location.search).get("create");
    if (create === "enquiry") enquiryActions.setShowEnquiryWizard(true);
    else if (create === "quote") setShowQuoteCreateDialog(true);
    else if (create === "booking") setShowBookingCreateDialog(true);
    else if (create === "task") taskCreate.setShowTaskDialog(true);
    else if (create === "ticket") ticketCreate.setShowTicketDialog(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, readOnly]);

  // Deep-link support: /clients/:id?holiday=quote:<id> (or booking:/enquiry:)
  // opens the client page with that holiday selected in the center detail view —
  // the pipeline board and Pipeline Live link here instead of the old
  // standalone pages. Keyed on the search string too (via wouter's useSearch,
  // not window.location.search) so a same-page link that only changes the
  // query string — e.g. another `navigate(...?holiday=...)` call while
  // already on this route — re-parses instead of being a no-op, since
  // clientId alone wouldn't change and wouter doesn't re-render on a
  // search-only change otherwise.
  useEffect(() => {
    const raw = new URLSearchParams(search).get("holiday");
    if (raw) {
      const [type, id] = raw.split(":");
      if ((type === "quote" || type === "booking" || type === "enquiry") && id) {
        setHolidaySelection({ type, id });
        return;
      }
    }
    setHolidaySelection(null);
  }, [clientId, search]);

  async function handleConvertEnquiryToQuote(enq: EnquiryTable) {
    if (!enq.transaction_id) {
      toast({
        title: "Conversion Error",
        description: "This enquiry is missing a transaction ID and cannot be converted.",
        variant: "destructive",
      });
      return;
    }
    setConvertingFromEnquiryTxnId(enq.transaction_id);
    setConvertingEnquiryId(enq.id);
    // The transactions list query only hydrates `destinations` on each enquiry,
    // so seed from the fully-hydrated enquiry (resorts/boardBases/airports/
    // passengers) fetched by id — mirroring the pipeline board's convert flow.
    try {
      const full = await queryClient.fetchQuery({
        queryKey: enquiryKeys.detail(enq.id),
        queryFn: () => enquiryApi.getById(enq.id),
      });
      setConvertingEnquiryInitialValues(buildQuoteInitialValuesFromEnquiry(full));
    } catch {
      // Fall back to whatever the list provided rather than blocking the convert.
      setConvertingEnquiryInitialValues(buildQuoteInitialValuesFromEnquiry(enq));
    }
    setShowQuoteCreateDialog(true);
  }

  const client = useMemo(() => {
    if (!clientData) return null;
    return transformNeonClientData(clientData);
  }, [clientData]);

  const isFavorited = useMemo(
    () => userFavorites?.some((f) => f.itemId === clientId && f.itemType === "client") ?? false,
    [userFavorites, clientId],
  );

  function handleToggleClientPin() {
    if (!client) return;
    toggleFavoriteMutation.mutate(
      { itemType: "client", itemId: clientId, label: client.name, subtitle: client.email || undefined },
      {
        onSuccess: () =>
          toast({ title: isFavorited ? "Client unpinned" : "Client pinned" }),
        onError: () => toast({ title: "Failed to update pin", variant: "destructive" }),
      },
    );
  }

  function handleChangeClientBadge(badge: string | null) {
    editForm.updateNeonClientMutation.mutate(
      { id: clientId, data: { badge } },
      {
        onSuccess: () => toast({ title: "Badge updated" }),
        onError: () => toast({ title: "Failed to update badge", variant: "destructive" }),
      },
    );
  }

  function handleToggleAiReply(enabled: boolean) {
    editForm.updateNeonClientMutation.mutate(
      { id: clientId, data: { aiReplyEnabled: enabled } },
      {
        onSuccess: () =>
          toast({
            title: enabled ? "AI auto-reply enabled" : "AI auto-reply disabled",
            description: enabled
              ? "The AI will now reply automatically in this client's conversations."
              : "The AI will stay silent in this client's conversations.",
          }),
        onError: () => toast({ title: "Failed to update AI auto-reply", variant: "destructive" }),
      },
    );
  }

  const transactions = useMemo(() => transactionsData || [], [transactionsData]);
  const quotes = useMemo(() => transactions.flatMap((t: Transaction) => t.quotes || []), [transactions]);
  const enquiries = useMemo(
    () => transactions.map((t: Transaction) => t.enquiry).filter(Boolean) as EnquiryTable[],
    [transactions],
  );
  const bookings = useMemo(
    () => transactions.flatMap((t: Transaction) => (t.booking ? [{ ...t.booking, user_id: t.user_id }] : [])),
    [transactions],
  );

  const tasks = useMemo(() => tasksData ?? [], [tasksData]);
  const stats = useMemo(() => computeClientStats(enquiries, quotes, bookings), [enquiries, quotes, bookings]);
  const taskHolidays = useMemo(() => buildTaskHolidays(enquiries, quotes, bookings), [enquiries, quotes, bookings]);
  const dealLabels = useMemo(() => buildDealLabels(enquiries, quotes, bookings), [enquiries, quotes, bookings]);

  if (isLoadingClient) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-client">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-client">
        <div className="text-center">
          <p className="text-sm text-black/70">Client not found</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("/clients")}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  const handleCreate = (kind: ClientCreateKind) => {
    if (kind === "enquiry") enquiryActions.setShowEnquiryWizard(true);
    else if (kind === "quote") setShowQuoteCreateDialog(true);
    else if (kind === "booking") setShowBookingCreateDialog(true);
    else if (kind === "task") taskCreate.setShowTaskDialog(true);
    else if (kind === "ticket") ticketCreate.setShowTicketDialog(true);
  };

  const saveReferrer = (referredByClientId: string | null) =>
    editForm.updateNeonClientMutation.mutate(
      { id: clientId, data: { referredByClientId } },
      {
        onSuccess: () => {
          setShowReferrerModal(false);
          toast({ title: referredByClientId ? "Referrer saved" : "Referrer removed" });
        },
        onError: () => toast({ title: referredByClientId ? "Failed to save referrer" : "Failed to remove referrer", variant: "destructive" }),
      },
    );

  // Two layouts share one page: the redesigned overview (header, stat boxes,
  // dashboard card, side cards and the Live deals rail) when nothing is
  // selected, and the original three-column holidays / detail / details layout
  // once a deal is opened.
  const overviewLayout = (
    <section
      className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col bg-social-page md:-m-6 xl:h-[calc(100vh-3.5rem)] xl:min-h-0 xl:flex-row xl:overflow-hidden"
      data-testid="section-client-profile"
    >
      <div className="flex min-w-0 flex-1 flex-col xl:min-h-0 xl:overflow-y-auto">
        <ClientPageHeader
          name={client.name}
          phone={client.phone}
          clientData={clientData}
          isFavorited={isFavorited}
          readOnly={readOnly}
          aiReplyEnabled={!!clientData?.aiReplyEnabled}
          onEdit={editForm.openEditDialog}
          onShare={() => setShowShareModal(true)}
          onTogglePin={handleToggleClientPin}
          onChangeBadge={handleChangeClientBadge}
          onNewDeal={handleCreate}
          onAddTask={() => taskCreate.setShowTaskDialog(true)}
          onNewTicket={() => ticketCreate.setShowTicketDialog(true)}
          onMerge={() => setShowMergeDialog(true)}
          onToggleAiReply={handleToggleAiReply}
        />
        <div className="p-4 md:p-6" data-testid="client-index-view">
          <div className="grid gap-5 2xl:grid-cols-[1.45fr_1fr]">
            <div className="flex min-w-0 flex-col gap-5">
              <ClientStatBoxes stats={stats} />
              <ClientDashboardCard
                clientId={clientId}
                clientName={client.name}
                role={role}
                readOnly={readOnly}
                tasks={tasks}
                users={usersData ?? []}
                taskHolidays={taskHolidays}
                dealLabels={dealLabels}
                rawTickets={ticketsData ?? []}
                clientFiles={fileActions.clientFilesData}
                onAddTask={() => taskCreate.setShowTaskDialog(true)}
                onNewTicket={() => ticketCreate.setShowTicketDialog(true)}
                onUploadFile={() => fileActions.setShowUploadFileModal(true)}
                onDeleteFile={fileActions.deleteFile}
                onOpenDeal={setHolidaySelection}
                onOpenTicket={(ticketId) => navigate(`/tickets/${ticketId}`)}
                onViewAllTasks={() => navigate("/tasks")}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <ReferredByCard referrerId={clientData?.referredByClientId} readOnly={readOnly} onChange={() => setShowReferrerModal(true)} />
              <PortalAccessCard clientId={clientId} readOnly={readOnly} onChangePin={() => setShowPinModal(true)} />
              <ReferralNetworkCard clientId={clientId} />
            </div>
          </div>
        </div>
      </div>
      <LiveDealsRail
        enquiries={enquiries}
        quotes={quotes}
        bookings={bookings}
        state={liveDealsState}
        isLoading={isLoadingTransactions}
        readOnly={readOnly}
        onSelect={setHolidaySelection}
        onNewDeal={handleCreate}
      />
    </section>
  );

  const detailLayout = (
      <section
        className="text-compact -m-4 grid h-[calc(100vh-3.5rem)] grid-cols-1 gap-0 overflow-hidden rounded-tl-lg md:-m-6 lg:grid-cols-[250px_1fr_240px] xl:grid-cols-[300px_1fr_300px] 3xl:grid-cols-[380px_1fr_380px]"
        data-testid="section-client-profile"
      >
        <AllHolidaysPanel
          className="hidden lg:flex"
          enquiries={enquiries}
          quotes={quotes}
          bookings={bookings}
          selection={holidaySelection}
          onSelect={setHolidaySelection}
          onCreate={readOnly ? undefined : handleCreate}
          isLoadingTransactions={isLoadingTransactions}
        />

        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Center header — the client's name, aligned with the side panels'
              76px headers (All Holidays / Details), per the design. When a
              holiday is selected, the phone number becomes a pill next to the
              name and the deal-actions cluster (agent / pin / link / share /
              actions) takes the right side instead of the muted address line. */}
          <div className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-white px-4 3xl:px-6 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-sm font-semibold 3xl:text-base" data-testid="client-center-header">
                  {client.name}
                </h2>
                {client.phone && (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    {client.phone}
                  </span>
                )}
              </div>
            </div>
            {holidaySelection && (
              <HolidayHeaderActions
                selection={holidaySelection}
                clientId={clientId}
                clientName={client.name}
                onDeleted={() => setHolidaySelection(null)}
                onOpenExpiryDialog={quoteExpiry.openExpiryDialog}
                readOnly={readOnly}
              />
            )}
          </div>
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
        {holidaySelection && (
          <HolidayDetailView
            clientId={clientId}
            clientName={client.name}
            selection={holidaySelection}
            onBack={() => {
              setHolidaySelection(null);
              // A deal may have been created or converted while it was open.
              queryClient.invalidateQueries({ queryKey: transactionKeys.list({ clientId }) });
            }}
            onOpenExpiryDialog={quoteExpiry.openExpiryDialog}
            readOnly={readOnly}
          />
        )}
          </div>
        </div>

        <HolidayDetailsPanel
          className="hidden lg:flex"
          selection={holidaySelection}
          enquiries={enquiries}
          quotes={quotes}
          bookings={bookings}
        />
      </section>
  );

  return (
    <>
      {holidaySelection ? detailLayout : overviewLayout}
      <QuoteCreateDialog
        presentation="drawer"
        transactionId={convertingFromEnquiryTxnId || undefined}
        clientId={clientId}
        userId={currentUser?.id}
        open={showQuoteCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowQuoteCreateDialog(false);
            setConvertingFromEnquiryTxnId(null);
            setConvertingEnquiryId(null);
            setConvertingEnquiryInitialValues(undefined);
          }
        }}
        onSuccess={(newQuoteId) => {
          // Only jump the selection when this was actually a conversion (not
          // a plain "create quote" from the "+" menu, where convertingEnquiryId
          // is never set). The dialog calls onOpenChange(false) before
          // onSuccess, but that only schedules the convertingEnquiryId reset —
          // this closure still sees the value captured at render time.
          if (convertingEnquiryId) {
            enquiryActions.updateEnquiryMutation.mutate({
              id: convertingEnquiryId,
              data: { status: "Converted" },
            });
            // Converting drops the enquiry out of the holidays list immediately
            // (the transactions API stops returning `enquiry` once it leaves
            // on_enquiry) — select the new quote instead of leaving the
            // selection pointing at something no longer in the list.
            setHolidaySelection({ type: "quote", id: newQuoteId });
          }
        }}
        initialValues={convertingEnquiryInitialValues}
      />
      <BookingCreateDialog
        presentation="drawer"
        clientId={clientId}
        open={showBookingCreateDialog}
        onOpenChange={setShowBookingCreateDialog}
        onSuccess={(bookingId) => {
          navigate(`/clients/${clientId}?holiday=booking:${bookingId}`);
        }}
      />

      <CreateTaskDialog
        open={taskCreate.showTaskDialog}
        onOpenChange={taskCreate.setShowTaskDialog}
        entityType="client"
        entityId={clientId}
        defaultAssignedToId={currentUser?.id}
      />

      <CreateTicketDialog
        presentation="drawer"
        open={ticketCreate.showTicketDialog}
        onOpenChange={ticketCreate.setShowTicketDialog}
        clientName={clientData ? `${clientData.firstName} ${clientData.surename}`.trim() : "this client"}
        ticketForm={ticketCreate.ticketForm}
        setTicketForm={ticketCreate.setTicketForm}
        ticketPendingFiles={ticketCreate.ticketPendingFiles}
        ticketFileInputRef={ticketCreate.ticketFileInputRef}
        isUploading={ticketCreate.isTicketUploading}
        isPending={ticketCreate.createTicketMutation.isPending}
        users={usersData ?? []}
        onFileSelect={ticketCreate.handleTicketFileSelect}
        removePendingFile={ticketCreate.removeTicketPendingFile}
        formatFileSize={ticketCreate.formatTicketFileSize}
        onConfirm={ticketCreate.handleCreateTicket}
        onReset={ticketCreate.resetTicketForm}
      />

      <UploadFileDialog
        open={fileActions.showUploadFileModal}
        onOpenChange={fileActions.setShowUploadFileModal}
        clientName={client?.name || "this client"}
        quotes={quotes}
        uploadFile={fileActions.uploadFile}
        setUploadFile={fileActions.setUploadFile}
        onUpload={fileActions.handleUploadFile}
      />
      <EditClientModal
        open={editForm.showEditClient}
        onOpenChange={editForm.setShowEditClient}
        form={editForm.editForm}
        setForm={editForm.setEditForm}
        onSave={editForm.handleSaveClient}
        isPending={editForm.isPending}
      />
      <ReferrerModal
        open={showReferrerModal}
        onOpenChange={setShowReferrerModal}
        clientId={clientId}
        firstName={clientData?.firstName || "this client"}
        hasReferrer={!!clientData?.referredByClientId}
        isPending={editForm.updateNeonClientMutation.isPending}
        onSelect={saveReferrer}
        onClear={() => saveReferrer(null)}
      />
      <PortalPinModal clientId={clientId} open={showPinModal} onOpenChange={setShowPinModal} />
      <ShareClientModal open={showShareModal} onOpenChange={setShowShareModal} />

      <EnquiryWizard
        presentation="drawer"
        open={enquiryActions.showEnquiryWizard}
        onOpenChange={enquiryActions.onWizardOpenChange}
        enquiry={enquiryActions.editingEnquiry}
        onSubmit={enquiryActions.handleEnquirySubmit}
        isSaving={enquiryActions.createTransactionMutation.isPending || enquiryActions.updateEnquiryMutation.isPending}
      />

      <MergeClientDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        sourceClientId={clientId}
        sourceClientName={client?.name || "this client"}
        onMerged={(survivingClientId) => navigate(`/clients/${survivingClientId}`)}
      />

      <QuoteExpiryDialog
        open={quoteExpiry.showExpiryDialog}
        onOpenChange={quoteExpiry.setShowExpiryDialog}
        expiryDate={quoteExpiry.expiryDate}
        onExpiryDateChange={quoteExpiry.setExpiryDate}
        isPending={quoteExpiry.updateQuoteExpiryMutation.isPending}
        onConfirm={quoteExpiry.confirmExpiry}
      />
    </>
  );
}
