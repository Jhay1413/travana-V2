import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
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

import { transformNeonClientData, transformTicket, filesFor } from "@/features/client/components/client-types";
import { EditClientDialog } from "@/features/client/components/modals/EditClientDialog";
import { MergeClientDialog } from "@/features/client/components/modals/MergeClientDialog";
import { UploadFileDialog } from "@/features/client/components/modals/UploadFileDialog";
import { AllHolidaysPanel } from "@/features/client/components/all-holidays-panel";
import { HolidayDetailsPanel } from "@/features/client/components/holiday-details-panel";
import { HolidayDetailView } from "@/features/client/components/holiday-detail-view";
import { ClientIndexView, composeAddress } from "@/features/client/components/client-index-view";
import type { HolidaySelection } from "@/features/client/types";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import { BookingCreateDialog } from "@/features/booking/components/booking-create-dialog";
import { CreateTaskDialog } from "@/features/client/components/modals/CreateTaskDialog";
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
  const { toast } = useToast();

  const { role } = useRole();
  const [q, setQ] = useState("");
  const [showQuoteCreateDialog, setShowQuoteCreateDialog] = useState(false);
  const [showBookingCreateDialog, setShowBookingCreateDialog] = useState(false);
  const [convertingFromEnquiryTxnId, setConvertingFromEnquiryTxnId] = useState<string | null>(null);
  const [convertingEnquiryId, setConvertingEnquiryId] = useState<string | null>(null);
  const [convertingEnquiryInitialValues, setConvertingEnquiryInitialValues] = useState<Partial<QuoteFormValues> | undefined>(undefined);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [holidaySelection, setHolidaySelection] = useState<HolidaySelection | null>(null);
  const clientId = params?.clientId ?? "";

  const { data: clientData, isLoading: isLoadingClient } = useNeonClient(clientId);
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({ clientId });
  const { data: ticketsData } = useTicketsByClient(clientId);
  const { data: tasksData } = useTasks("client", clientId);
  const { data: usersData } = useUsers();
  const { data: currentUser } = useCurrentUser();

  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const queryClient = useQueryClient();

  const editForm = useClientEditForm(clientId, clientData);
  const fileActions = useClientFiles(clientId);
  const taskCreate = useClientTaskCreate(clientId, currentUser?.id);
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id);
  const enquiryActions = useClientEnquiryActions(clientId, currentUser?.id, () => {
    setConvertingFromEnquiryTxnId(null);
    setConvertingEnquiryId(null);
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const create = params.get("create");
    if (create === "enquiry") enquiryActions.setShowEnquiryWizard(true);
    else if (create === "quote") setShowQuoteCreateDialog(true);
    else if (create === "booking") setShowBookingCreateDialog(true);
    else if (create === "task") taskCreate.setShowTaskDialog(true);
    else if (create === "ticket") ticketCreate.setShowTicketDialog(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link support: /clients/:id?holiday=quote:<id> (or booking:/enquiry:)
  // opens the client page with that holiday selected in the center detail view —
  // the pipeline board and Pipeline Live link here instead of the old
  // standalone pages. Re-parses on client change so stale selections never
  // leak across clients.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("holiday");
    if (raw) {
      const [type, id] = raw.split(":");
      if ((type === "quote" || type === "booking" || type === "enquiry") && id) {
        setHolidaySelection({ type, id });
        return;
      }
    }
    setHolidaySelection(null);
  }, [clientId]);

  async function handleConvertEnquiryToQuote(enq: EnquiryTable) {
    if (!enq.transaction_id) {
      console.error("❌ Enquiry missing transaction_id:", enq);
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

  const tickets = useMemo(() => (ticketsData ? ticketsData.map(transformTicket) : []), [ticketsData]);
  const tasks = useMemo(() => tasksData ?? [], [tasksData]);
  const files = useMemo(() => (client ? filesFor(client.id) : []), [client]);

  function getUserName(userId: string) {
    const user = usersData?.find((u) => u.id === userId);
    return user?.name || "Unassigned";
  }

  const filteredTickets = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((t) =>
      `${t.id} ${t.subject} ${t.status} ${t.type} ${t.priority}`.toLowerCase().includes(query),
    );
  }, [q, tickets]);
  void filteredTickets;

  const filteredFiles = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return files;
    return files.filter((f) => `${f.id} ${f.name} ${f.type} ${f.updated}`.toLowerCase().includes(query));
  }, [q, files]);
  void setQ;

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

  return (
    <>
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
          onCreate={(kind) => {
            if (kind === "enquiry") enquiryActions.setShowEnquiryWizard(true);
            else if (kind === "quote") setShowQuoteCreateDialog(true);
            else if (kind === "booking") setShowBookingCreateDialog(true);
            else if (kind === "task") taskCreate.setShowTaskDialog(true);
            else if (kind === "ticket") ticketCreate.setShowTicketDialog(true);
          }}
          isLoadingTransactions={isLoadingTransactions}
        />

        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Center header — the client's name, aligned with the side panels'
              76px headers (All Holidays / Details), per the design. */}
          <div className="flex h-[76px] shrink-0 flex-col justify-center border-b border-black/10 bg-white px-4 3xl:px-6 dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="truncate text-sm font-semibold 3xl:text-base" data-testid="client-center-header">
              {client.name}
            </h2>
            {(client.phone || composeAddress(clientData)) && (
              <p className="mt-0.5 truncate text-xs text-black/45 3xl:text-[13px] dark:text-white/45" data-testid="client-center-header-contact">
                {[client.phone, composeAddress(clientData)].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
        {holidaySelection ? (
          <HolidayDetailView
            clientId={clientId}
            clientName={client.name}
            selection={holidaySelection}
            onBack={() => setHolidaySelection(null)}
          />
        ) : (
          <ClientIndexView
            clientId={clientId}
            client={client}
            clientData={clientData}
            onEdit={editForm.openEditDialog}
            onMerge={() => setShowMergeDialog(true)}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleClientPin}
            onChangeBadge={handleChangeClientBadge}
            aiReplyEnabled={!!clientData?.aiReplyEnabled}
            onToggleAiReply={handleToggleAiReply}
            onSelectReferrer={(referredByClientId) => {
              editForm.updateNeonClientMutation.mutate(
                { id: clientId, data: { referredByClientId } },
                {
                  onSuccess: () => toast({ title: "Referrer saved" }),
                  onError: () => toast({ title: "Failed to save referrer", variant: "destructive" }),
                },
              );
            }}
            onClearReferrer={() => {
              editForm.updateNeonClientMutation.mutate(
                { id: clientId, data: { referredByClientId: null } },
                {
                  onSuccess: () => toast({ title: "Referrer removed" }),
                  onError: () => toast({ title: "Failed to remove referrer", variant: "destructive" }),
                },
              );
            }}
            enquiries={enquiries}
            quotes={quotes}
            bookings={bookings}
            overviewTickets={tickets}
            tasks={tasks}
            navigate={navigate}
            clientFiles={fileActions.clientFilesData}
            filteredFiles={filteredFiles}
            onDeleteFile={fileActions.deleteFile}
            onUploadFile={() => fileActions.setShowUploadFileModal(true)}
            role={role}
            rawTickets={ticketsData ?? []}
            users={usersData ?? []}
            onNewTicket={() => ticketCreate.setShowTicketDialog(true)}
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
        onSuccess={() => {
          if (convertingEnquiryId) {
            enquiryActions.updateEnquiryMutation.mutate({
              id: convertingEnquiryId,
              data: { status: "Converted" },
            });
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
          navigate(`/clients/${clientId}/bookings/${bookingId}`);
        }}
      />

      <CreateTaskDialog
        presentation="drawer"
        open={taskCreate.showTaskDialog}
        onOpenChange={taskCreate.setShowTaskDialog}
        taskForm={taskCreate.taskForm}
        setTaskForm={taskCreate.setTaskForm}
        isPending={taskCreate.createTaskMutation.isPending}
        onConfirm={taskCreate.confirmCreateTask}
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
      <EditClientDialog
        open={editForm.showEditClient}
        onOpenChange={editForm.setShowEditClient}
        editForm={editForm.editForm}
        setEditForm={editForm.setEditForm}
        onSave={editForm.handleSaveClient}
        isPending={editForm.isPending}
      />

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
    </>
  );
}
