import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useRole } from "@/hooks/use-role";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  useNeonClient,
  useTransactions,
  useTicketsByClient,
  useUsers,
  useCurrentUser,
  useTasks,
} from "@/hooks/queries";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Transaction, EnquiryTable } from "@/types/quote";
import { useToast } from "@/hooks/use-toast";
import { EnquiryWizard } from "@/components/enquiry-wizard";

import { transformNeonClientData, transformTicket, filesFor } from "@/components/client/client-types";
import { EditClientDialog } from "@/components/client/modals/EditClientDialog";
import { UploadFileDialog } from "@/components/client/modals/UploadFileDialog";
import { QuoteCreateDialog } from "@/components/quote/quote-create-dialog";
import { BookingCreateDialog } from "@/components/booking/booking-create-dialog";
import {
  ClientOverviewTab,
  PortalPinSection,
  ReferralStatsSection,
} from "@/components/client/tabs/ClientOverviewTab";
import { ClientEnquiriesTab } from "@/components/client/tabs/ClientEnquiriesTab";
import { ClientQuotesTab } from "@/components/client/tabs/ClientQuotesTab";
import { ClientBookedTab } from "@/components/client/tabs/ClientBookedTab";
import { ClientFilesTab } from "@/components/client/tabs/ClientFilesTab";
import { ClientTicketsTab } from "@/components/client/tabs/ClientTicketsTab";
import { ClientVipClubTab } from "@/components/client/tabs/ClientVipClubTab";
import { ReferrerSelector } from "@/components/client/sections/ReferrerSelector";
import { ClientContactDetails } from "@/components/client/sections/ClientContactDetails";
import { CreateTaskDialog } from "@/components/client/modals/CreateTaskDialog";
import { CreateTicketDialog } from "@/components/client/modals/CreateTicketDialog";
import {
  useClientEditForm,
  useClientFiles,
  useClientTaskCreate,
  useClientTicketCreate,
  useClientEnquiryActions,
} from "@/components/client/hooks";

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const { toast } = useToast();

  const { role } = useRole();
  const [q, setQ] = useState("");
  type ClientTab = "overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets" | "vip-club";
  const validTabs: ClientTab[] = ["overview", "enquiries", "quotes", "booked", "files", "tickets", "vip-club"];
  const [tab, setTab] = useState<ClientTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as ClientTab | null;
    return t && validTabs.includes(t) ? t : "overview";
  });
  const [expandedCopyGroups, setExpandedCopyGroups] = useState<Record<string, boolean>>({});
  const [showQuoteCreateDialog, setShowQuoteCreateDialog] = useState(false);
  const [showBookingCreateDialog, setShowBookingCreateDialog] = useState(false);
  const [convertingFromEnquiryTxnId, setConvertingFromEnquiryTxnId] = useState<string | null>(null);
  const [convertingEnquiryId, setConvertingEnquiryId] = useState<string | null>(null);
  const [isContactDetailsOpen, setIsContactDetailsOpen] = useState(true);
  const clientId = params?.clientId ?? "";

  const { data: clientData, isLoading: isLoadingClient } = useNeonClient(clientId);
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({ clientId });
  const { data: ticketsData } = useTicketsByClient(clientId);
  const { data: tasksData } = useTasks("client", clientId);
  const { data: usersData } = useUsers();
  const { data: currentUser } = useCurrentUser();

  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

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

  function handleConvertEnquiryToQuote(enq: EnquiryTable) {
    if (!enq.transaction_id) {
      console.error("❌ Enquiry missing transaction_id:", enq);
      toast({
        title: "Conversion Error",
        description: "This enquiry is missing a transaction ID and cannot be converted.",
        variant: "destructive",
      });
      return;
    }
    console.log("✅ Converting enquiry to quote - Transaction ID:", enq.transaction_id);
    setConvertingFromEnquiryTxnId(enq.transaction_id);
    setConvertingEnquiryId(enq.id);
    setShowQuoteCreateDialog(true);
  }

  const client = useMemo(() => {
    if (!clientData) return null;
    return transformNeonClientData(clientData);
  }, [clientData]);

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

  const convertingEnquiryInitialValues = useMemo(() => {
    if (!convertingFromEnquiryTxnId) return undefined;
    const txn = transactions.find((t: Transaction) => t.id === convertingFromEnquiryTxnId);
    const enq = txn?.enquiry;
    if (!enq) return undefined;
    return {
      packageType: enq.holiday_type_id || "",
      quoteTitle: enq.title || "",
      travelDate: enq.travel_date || "",
      passengersAdults: enq.adults || 2,
      passengersChildren: enq.children || 0,
      passengersInfants: enq.infants || 0,
      nights: enq.no_of_nights || 7,
      destination: enq.destinations?.[0]?.destination_id || "",
      resort: enq.resorts?.[0]?.resort_id || "",
      boardBasisId: enq.boardBases?.[0]?.board_basis_id || "",
      outboundDepartAirportId: enq.airports?.[0]?.airport_id || "",
    };
  }, [convertingFromEnquiryTxnId, transactions]);

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
      <div className="relative min-h-[calc(100vh-56px)] w-full ">
        <div className="relative mt-2 grid gap-2 lg:grid-cols-12" data-testid="layout-client-page">
          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-3 lg:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/clients")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                  data-testid="button-back-clients"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>

                <ReferrerSelector
                  className="min-w-0 flex-1"
                  currentReferredByClientId={clientData?.referredByClientId}
                  excludeClientId={clientId}
                  onSelect={(referredByClientId) => {
                    editForm.updateNeonClientMutation.mutate(
                      { id: clientId, data: { referredByClientId } },
                      {
                        onSuccess: () => toast({ title: "Referrer saved" }),
                        onError: () => toast({ title: "Failed to save referrer", variant: "destructive" }),
                      },
                    );
                  }}
                  onClear={() => {
                    editForm.updateNeonClientMutation.mutate(
                      { id: clientId, data: { referredByClientId: null } },
                      {
                        onSuccess: () => toast({ title: "Referrer removed" }),
                        onError: () => toast({ title: "Failed to remove referrer", variant: "destructive" }),
                      },
                    );
                  }}
                />
              </div>
            </div>

            <div className="mt-4 " data-testid="card-client-summary">
              <div className="mb-3">
                <ReferralStatsSection clientId={clientId} />
              </div>
            </div>
            <div className="mt-4 ">
              <PortalPinSection clientId={clientId} />
            </div>

            <ClientContactDetails
              clientData={clientData}
              isOpen={isContactDetailsOpen}
              onToggle={() => setIsContactDetailsOpen((v) => !v)}
              onEdit={editForm.openEditDialog}
            />
          </Card>

          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-3 lg:col-span-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold" data-testid="text-client-right-title">
                  Client workspace
                </div>
                <div className="mt-1 text-xs text-black/55" data-testid="text-client-right-subtitle">
                  Knowing you client is the key to Rapport
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-workspace">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
                <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 rounded-2xl border border-black/10 bg-white/70">
                  <TabsTrigger value="overview" className="rounded-xl" data-testid="tab-overview">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="enquiries" className="rounded-xl" data-testid="tab-enquiries">
                    Enquiries
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="rounded-xl" data-testid="tab-quotes">
                    Quotes
                  </TabsTrigger>
                  <TabsTrigger value="booked" className="rounded-xl" data-testid="tab-booked">
                    Booked
                  </TabsTrigger>
                  <TabsTrigger value="files" className="rounded-xl" data-testid="tab-files">
                    Files
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="rounded-xl" data-testid="tab-tickets">
                    Tickets
                  </TabsTrigger>
                  <TabsTrigger value="vip-club" className="rounded-xl" data-testid="tab-vip-club">
                    VIP Club
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <ClientOverviewTab
                    clientData={clientData}
                    client={client}
                    enquiries={enquiries}
                    quotes={quotes}
                    bookings={bookings}
                    tickets={tickets}
                    tasks={tasks}
                    clientId={clientId}
                    navigate={navigate}
                  />
                </TabsContent>

                <TabsContent value="enquiries" className="mt-3">
                  <ClientEnquiriesTab
                    enquiries={enquiries}
                    isLoadingTransactions={isLoadingTransactions}
                    clientId={clientId}
                    navigate={navigate}
                    client={client}
                    userFavorites={userFavorites}
                    toggleFavoriteMutation={toggleFavoriteMutation}
                    onConvertEnquiryToQuote={handleConvertEnquiryToQuote}
                    onEditEnquiry={enquiryActions.openWizardForEdit}
                    onNewEnquiry={enquiryActions.openWizardForNew}
                    onDeleteEnquiry={enquiryActions.handleDeleteEnquiry}
                  />
                </TabsContent>

                <TabsContent value="quotes" className="mt-3">
                  <ClientQuotesTab
                    quotes={quotes}
                    bookings={bookings}
                    transactions={transactions}
                    clientId={clientId}
                    navigate={navigate}
                    onNewQuote={() => setShowQuoteCreateDialog(true)}
                    expandedCopyGroups={expandedCopyGroups}
                    setExpandedCopyGroups={setExpandedCopyGroups}
                    client={client}
                    userFavorites={userFavorites}
                    toggleFavoriteMutation={toggleFavoriteMutation}
                  />
                </TabsContent>

                <TabsContent value="booked" className="mt-3">
                  <ClientBookedTab
                    bookings={bookings}
                    clientId={clientId}
                    navigate={navigate}
                    onAddBooking={() => setShowBookingCreateDialog(true)}
                    client={client}
                    userFavorites={userFavorites}
                    toggleFavoriteMutation={toggleFavoriteMutation}
                    getUserName={getUserName}
                  />
                </TabsContent>

                <TabsContent value="files" className="mt-3">
                  <ClientFilesTab
                    clientFiles={fileActions.clientFilesData}
                    onDeleteFile={fileActions.deleteFile}
                    filteredFiles={filteredFiles}
                    onUploadFile={() => fileActions.setShowUploadFileModal(true)}
                    role={role}
                  />
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <ClientTicketsTab
                    tickets={ticketsData ?? []}
                    users={usersData ?? []}
                    onNewTicket={() => ticketCreate.setShowTicketDialog(true)}
                  />
                </TabsContent>

                <TabsContent value="vip-club" className="mt-3">
                  <ClientVipClubTab clientId={clientId} />
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>
      </div>
      <QuoteCreateDialog
        transactionId={convertingFromEnquiryTxnId || undefined}
        clientId={clientId}
        userId={currentUser?.id}
        open={showQuoteCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowQuoteCreateDialog(false);
            setConvertingFromEnquiryTxnId(null);
            setConvertingEnquiryId(null);
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
        clientId={clientId}
        open={showBookingCreateDialog}
        onOpenChange={setShowBookingCreateDialog}
        onSuccess={(bookingId) => {
          navigate(`/clients/${clientId}/bookings/${bookingId}`);
        }}
      />

      <CreateTaskDialog
        open={taskCreate.showTaskDialog}
        onOpenChange={taskCreate.setShowTaskDialog}
        taskForm={taskCreate.taskForm}
        setTaskForm={taskCreate.setTaskForm}
        isPending={taskCreate.createTaskMutation.isPending}
        onConfirm={taskCreate.confirmCreateTask}
      />

      <CreateTicketDialog
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
        open={enquiryActions.showEnquiryWizard}
        onOpenChange={enquiryActions.onWizardOpenChange}
        enquiry={enquiryActions.editingEnquiry}
        onSubmit={enquiryActions.handleEnquirySubmit}
        isSaving={enquiryActions.createEnquiryMutation.isPending || enquiryActions.updateEnquiryMutation.isPending}
      />
    </>
  );
}
