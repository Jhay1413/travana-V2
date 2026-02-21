import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Phone,
  Sparkles,
  Ticket,
  UserRound,
  Pin,
  PinOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNeonClient, useTransactions, useTicketsByClient, useUsers, useCurrentUser } from "@/hooks/queries";
import { useUpdateClient, useUpdateNeonClient, useCreateEnquiry, useUpdateEnquiry, useDeleteEnquiry, useCreateTransaction } from "@/hooks/mutations";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";
import type { Transaction, EnquiryTable } from "@/types/quote";
import { useToast } from "@/hooks/use-toast";
import { EnquiryWizard } from "@/components/enquiry-wizard";

import { tierPill, transformNeonClientData, transformTicket, formatTicketDate, ticketStatusPill, ticketTypePill, filesFor } from "@/components/client/client-types";
import { EditClientDialog } from "@/components/client/EditClientDialog";
import { UploadFileDialog } from "@/components/client/UploadFileDialog";
import type { Client as ApiClient } from "@/types/client";
import { QuoteCreateDialog } from "@/components/quote-create-dialog";
import { BookingCreateDialog } from "@/components/booking-create-dialog";
import { ClientOverviewTab } from "@/components/client/ClientOverviewTab";
import { ClientEnquiriesTab } from "@/components/client/ClientEnquiriesTab";
import { ClientQuotesTab } from "@/components/client/ClientQuotesTab";
import { ClientBookedTab } from "@/components/client/ClientBookedTab";
import { ClientFilesTab } from "@/components/client/ClientFilesTab";
import { ClientTicketsTab } from "@/components/client/ClientTicketsTab";

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const { toast } = useToast();

  const { role, setRole } = useRole();
  const [active] = useState<string>("clients");
  const [q, setQ] = useState("");
  type ClientTab = "overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets";
  const [tab, setTab] = useState<ClientTab>("overview");
  const [expandedCopyGroups, setExpandedCopyGroups] = useState<Record<string, boolean>>({});
  const [showEditClient, setShowEditClient] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    firstName: "",
    surename: "",
    phoneNumber: "",
    email: "",
    DOB: "",
    houseNumber: "",
    street: "",
    city: "",
    country: "",
    post_code: "",
    badge: "",
  });
  const [showQuoteCreateDialog, setShowQuoteCreateDialog] = useState(false);
  const [showBookingCreateDialog, setShowBookingCreateDialog] = useState(false);
  const [convertingFromEnquiryTxnId, setConvertingFromEnquiryTxnId] = useState<string | null>(null);
  const [convertingEnquiryId, setConvertingEnquiryId] = useState<string | null>(null);
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<{
    file: File | null;
    title: string;
    fileType: string;
    allocationType: string;
    allocationId: string;
  }>({
    file: null,
    title: "",
    fileType: "",
    allocationType: "",
    allocationId: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState<{
    id: string;
    name: string;
    title: string;
    type: string;
    category: string;
    allocationType: string;
    allocationId: string;
    updated: string;
    url: string;
  }[]>([]);
  const clientId = params?.clientId ?? "";

  const { data: clientData, isLoading: isLoadingClient } = useNeonClient(clientId);

  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({ clientId });

  const { data: ticketsData, isLoading: isLoadingTickets } = useTicketsByClient(clientId);

  const { data: usersData } = useUsers();

  const { data: currentUser } = useCurrentUser();

  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const isClientPinned = useMemo(() => {
    if (!userFavorites || !clientId) return false;
    return userFavorites.some((f: Favorite) => f.itemType === "client" && f.itemId === clientId);
  }, [userFavorites, clientId]);

  const updateClientMutationHook = useUpdateClient();
  const updateClientMutation = {
    mutate: (args: { id: string; data: Partial<ApiClient> }) => {
      updateClientMutationHook.mutate(args, {
        onSuccess: () => {
          toast({ title: "Client updated" });
        },
        onError: () => {
          toast({ title: "Failed to update client", variant: "destructive" });
        },
      });
    },
  };

  const updateNeonClientMutation = useUpdateNeonClient();

  const openEditDialog = () => {
    if (clientData) {
      setEditForm({
        title: clientData.title || "",
        firstName: clientData.firstName || "",
        surename: clientData.surename || "",
        phoneNumber: clientData.phoneNumber || "",
        email: clientData.email || "",
        DOB: clientData.DOB || "",
        houseNumber: clientData.houseNumber || "",
        street: clientData.street || "",
        city: clientData.city || "",
        country: clientData.country || "",
        post_code: clientData.post_code || "",
        badge: clientData.badge || "",
      });
      setShowEditClient(true);
    }
  };

  const handleSaveClient = () => {
    const updates: Record<string, string | boolean | null> = {};
    if (editForm.title) updates.title = editForm.title;
    if (editForm.firstName) updates.firstName = editForm.firstName;
    if (editForm.surename) updates.surename = editForm.surename;
    updates.phoneNumber = editForm.phoneNumber;
    updates.email = editForm.email || null;
    updates.DOB = editForm.DOB || null;
    updates.houseNumber = editForm.houseNumber || null;
    updates.street = editForm.street || null;
    updates.city = editForm.city || null;
    updates.country = editForm.country || null;
    updates.post_code = editForm.post_code || null;
    updates.badge = editForm.badge || null;

    updateNeonClientMutation.mutate(
      { id: clientId, data: updates },
      {
        onSuccess: () => {
          setShowEditClient(false);
          toast({ title: "Client updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update client", variant: "destructive" });
        },
      }
    );
  };

  const [showEnquiryWizard, setShowEnquiryWizard] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryTable | null>(null);
  const createEnquiryMutation = useCreateEnquiry();
  const updateEnquiryMutation = useUpdateEnquiry();
  const deleteEnquiryMutation = useDeleteEnquiry();
  const createTransactionMutation = useCreateTransaction();

  const handleEnquirySubmit = (data: Partial<EnquiryTable> & Record<string, unknown>) => {
    if (editingEnquiry) {
      updateEnquiryMutation.mutate(
        { id: editingEnquiry.id, data: data as Partial<EnquiryTable> },
        {
          onSuccess: () => {
            setShowEnquiryWizard(false);
            setEditingEnquiry(null);
            toast({ title: "Enquiry updated successfully" });
          },
          onError: () => {
            toast({ title: "Failed to update enquiry", variant: "destructive" });
          },
        }
      );
    } else {
      createTransactionMutation.mutate(
        {
          client_id: clientId,
          user_id: currentUser?.id || "",
          lead_source: undefined,
          enquiry: {
            title: (typeof data.enquiryTitle === 'string' ? data.enquiryTitle : undefined) || (typeof data.title === 'string' ? data.title : undefined) || "",
            holiday_type_id: (typeof data.holidayType === 'string' ? data.holidayType : undefined) || (typeof data.holiday_type_id === 'string' ? data.holiday_type_id : undefined) || "",
            travel_date: (typeof data.travelDate === 'string' ? data.travelDate : undefined) || (typeof data.travel_date === 'string' ? data.travel_date : undefined) || undefined,
            adults: (typeof data.passengersAdults === 'number' ? data.passengersAdults : undefined) || (typeof data.adults === 'number' ? data.adults : undefined) || undefined,
            children: (typeof data.passengersChildren === 'number' ? data.passengersChildren : undefined) || (typeof data.children === 'number' ? data.children : undefined) || undefined,
            infants: (typeof data.passengersInfants === 'number' ? data.passengersInfants : undefined) || (typeof data.infants === 'number' ? data.infants : undefined) || undefined,
            no_of_nights: (typeof data.nights === 'number' ? data.nights : undefined) || (typeof data.no_of_nights === 'number' ? data.no_of_nights : undefined) || undefined,
            budget: data.budget || undefined,
            max_budget: data.max_budget || undefined,
            budget_type: (typeof data.budgetType === 'string' ? data.budgetType : undefined) || (typeof data.budget_type === 'string' ? data.budget_type : undefined) || undefined,
            cabin_type: (typeof data.cabinType === 'string' ? data.cabinType : undefined) || (typeof data.cabin_type === 'string' ? data.cabin_type : undefined) || undefined,
            accom_min_star_rating: data.accom_min_star_rating || undefined,
            flexibility_date: data.flexibility_date || undefined,
            flexible_date: data.flexible_date || undefined,
            weekend_lodge: data.weekend_lodge || undefined,
            no_of_guests: data.no_of_guests || undefined,
            no_of_pets: data.no_of_pets || undefined,
            accomodation_type_id: data.accomodation_type_id || undefined,
            pre_cruise_stay: data.pre_cruise_stay || undefined,
            post_cruise_stay: data.post_cruise_stay || undefined,
            status: "ACTIVE",
            destinations: Array.isArray(data.destinations) ? data.destinations as any : undefined,
            resorts: Array.isArray(data.resorts) ? data.resorts as any : undefined,
            boardBases: Array.isArray(data.boardBases) ? data.boardBases as any : undefined,
            departureAirports: Array.isArray(data.departureAirports) ? data.departureAirports : undefined,
          },
        },
        {
          onSuccess: () => {
            setShowEnquiryWizard(false);
            toast({ title: "Enquiry created successfully" });
          },
          onError: () => {
            toast({ title: "Failed to create enquiry", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDeleteEnquiry = (id: string) => {
    deleteEnquiryMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Enquiry deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete enquiry", variant: "destructive" });
      },
    });
  };

  const handleConvertEnquiryToQuote = (enq: EnquiryTable) => {
    setConvertingFromEnquiryTxnId(enq.transaction_id);
    setConvertingEnquiryId(enq.id);
    setShowQuoteCreateDialog(true);
  };

  const handleUploadFile = () => {
    if (uploadFile.file) {
      const fileExt = uploadFile.file.name.split('.').pop()?.toUpperCase() || 'FILE';
      const fileUrl = URL.createObjectURL(uploadFile.file);
      setUploadedFiles((prev) => [
        {
          id: `uploaded-${Date.now()}`,
          name: uploadFile.file!.name,
          title: uploadFile.title || uploadFile.file!.name,
          type: fileExt,
          category: uploadFile.fileType,
          allocationType: uploadFile.allocationType || "None",
          allocationId: uploadFile.allocationId,
          updated: "Just now",
          url: fileUrl,
        },
        ...prev,
      ]);
    }
    setShowUploadFileModal(false);
    setUploadFile({ file: null, title: "", fileType: "", allocationType: "", allocationId: "" });
  };

  const client = useMemo(() => {
    if (!clientData) return null;
    return transformNeonClientData(clientData);
  }, [clientData]);

  const transactions = useMemo(() => transactionsData || [], [transactionsData]);
  const quotes = useMemo(() => transactions.flatMap((t: Transaction) => t.quotes || []), [transactions]);
  const enquiries = useMemo(() => transactions.map((t: Transaction) => t.enquiry).filter(Boolean) as EnquiryTable[], [transactions]);
  const bookings = useMemo(() => transactions.map((t: Transaction) => t.booking).filter((b): b is NonNullable<Transaction["booking"]> => Boolean(b)), [transactions]);

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
  const files = useMemo(() => (client ? filesFor(client.id) : []), [client]);

  const getUserName = (userId: string) => {
    const user = usersData?.find((u) => u.id === userId);
    return user?.name || "Unassigned";
  };

  const filteredTickets = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((t) =>
      `${t.id} ${t.subject} ${t.status} ${t.type} ${t.priority}`.toLowerCase().includes(query),
    );
  }, [q, tickets]);

  const filteredFiles = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return files;
    return files.filter((f) => `${f.id} ${f.name} ${f.type} ${f.updated}`.toLowerCase().includes(query));
  }, [q, files]);

  if (isLoadingClient) {
    return (
      <CommandCenterShell
        role={role}
        onRoleChange={setRole}
        active={active}
        title="Client"
        query={q}
        onQuery={setQ}
        theme="light"
        onToggleTheme={() => { }}
      >
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-client">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (!client) {
    return (
      <CommandCenterShell
        role={role}
        onRoleChange={setRole}
        active={active}
        title="Client"
        query={q}
        onQuery={setQ}
        theme="light"
        onToggleTheme={() => { }}
      >
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-client">
          <div className="text-center">
            <p className="text-sm text-black/70">Client not found</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/clients")}
            >
              Back to Clients
            </Button>
          </div>
        </div>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell
      role={role}
      onRoleChange={setRole}
      active={active}
      title={client.name}
      query={q}
      onQuery={setQ}
      theme="light"
      onToggleTheme={() => { }}
      headerExtra={
        <Select
          value={clientData?.badge || "New Client"}
          onValueChange={(value) => {
            if (clientId) {
              updateNeonClientMutation.mutate(
                { id: clientId, data: { badge: value } },
                {
                  onSuccess: () => {
                    toast({ title: "Client type updated" });
                  },
                  onError: () => {
                    toast({ title: "Failed to update client type", variant: "destructive" });
                  },
                }
              );
            }
          }}
        >
          <SelectTrigger
            className="h-auto w-auto rounded-full border-[#3b82f6]/30 bg-[#3b82f6]/10 px-3 py-1 text-xs font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/20"
            data-testid="select-client-type-header"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[400]">
            <SelectItem value="New Client">New Client</SelectItem>
            <SelectItem value="Repeat Client">Repeat Client</SelectItem>
            <SelectItem value="VIP Client">VIP Client</SelectItem>
            <SelectItem value="Family Member">Family Member</SelectItem>
            <SelectItem value="Time Waster">Time Waster</SelectItem>
            <SelectItem value="Banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="relative min-h-[calc(100vh-56px)] w-full px-4 pb-6 md:px-6 md:pb-8">
        <div className="relative mt-6 grid gap-3 lg:grid-cols-12" data-testid="layout-client-page">
          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-4 lg:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("/clients")}
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                data-testid="button-back-clients"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const clientName = client?.name || "Client";
                    const subtitle = client?.phone || client?.email || "";
                    toggleFavoriteMutation.mutate(
                      { itemType: "client", itemId: clientId, label: clientName, subtitle },
                      { onSuccess: (data: { favorited?: boolean; favorite?: Favorite }) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                    );
                  }}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${isClientPinned ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15" : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"}`}
                  data-testid="button-pin-client"
                >
                  {isClientPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {isClientPinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={openEditDialog}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                  data-testid="button-edit-client"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-client-summary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3" data-testid="text-client-name">
                    <span className="text-lg font-semibold">{client ? client.name : "Client"}</span>
                    {client?.phone && (
                      <a
                        href={`tel:${client.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#000000c4] hover:text-[#3b82f6] transition-colors"
                        data-testid="text-client-phone-header"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {client.phone}
                      </a>
                    )}
                  </div>
                  {client ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select
                        value={clientData?.badge || "New Client"}
                        onValueChange={(value) => {
                          if (clientId) {
                            updateClientMutation.mutate({ id: clientId, data: { clientType: value } });
                          }
                        }}
                      >
                        <SelectTrigger
                          className="h-auto w-auto rounded-full border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/20"
                          data-testid="select-client-type"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[400]">
                          <SelectItem value="New Client">New Client</SelectItem>
                          <SelectItem value="Repeat Client">Repeat Client</SelectItem>
                          <SelectItem value="VIP Client">VIP Client</SelectItem>
                          <SelectItem value="Family Member">Family Member</SelectItem>
                          <SelectItem value="Time Waster">Time Waster</SelectItem>
                          <SelectItem value="Banned">Banned</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${tierPill(client.tier)}`}
                        data-testid="pill-client-tier"
                      >
                        {client.tier}
                      </Badge>
                    </div>
                  ) : null}
                </div>
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]"
                  aria-hidden
                  data-testid="avatar-client"
                >
                  <UserRound className="h-5 w-5 text-black/70" />
                </div>
              </div>

              {client ? (
                <div className="mt-4 grid gap-2" data-testid="grid-client-kpis">
                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2">
                    <div className="text-[11px] font-semibold text-black/55" data-testid="label-client-email">
                      Email
                    </div>
                    <div className="mt-0.5 truncate text-sm text-black/85" data-testid="value-client-email-kpi">
                      {client.email || "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-black/55" data-testid="label-client-last-touch">
                          Last touch
                        </div>
                        <div className="mt-0.5 text-sm text-black/85" data-testid="value-client-last-touch">
                          {client.lastTouch}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                    </div>
                  </div>
                </div>
              ) : null}

            </div>

            <div className="mt-3 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-sections">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
                <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-black/10 bg-white/70">
                  <TabsTrigger value="overview" className="rounded-xl" data-testid="tab-client-overview">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="rounded-xl" data-testid="tab-client-tickets">
                    Tickets
                  </TabsTrigger>
                  <TabsTrigger value="files" className="rounded-xl" data-testid="tab-client-files">
                    Files
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <div className="grid gap-2" data-testid="panel-client-overview">
                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <div className="text-xs font-semibold" data-testid="text-client-stage-title">
                        Pipeline status
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2" data-testid="list-client-stage-chips">
                        {(["Enquiry", "Quote", "Booked"] as const).map((s) => (
                          <span
                            key={s}
                            className={
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                              (client?.stage === s
                                ? "border-[#3b82f6]/30 bg-[#3b82f6] text-white"
                                : "border-black/10 bg-black/[0.03] text-black/70")
                            }
                            data-testid={`pill-client-stage-${s.toLowerCase()}`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold" data-testid="text-client-tags-title">
                            Tags
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-tags-subtitle">
                            High-signal labels used across the CRM
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 rounded-2xl border border-black/10 bg-black/[0.03] px-3 text-black hover:bg-black/[0.05]"
                          data-testid="button-client-edit-tags"
                          onClick={() => { }}
                        >
                          <BadgeCheck className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2" data-testid="list-client-tags">
                        {(client?.tags ?? []).map((t, i) => (
                          <span
                            key={t + i}
                            className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                            data-testid={`pill-client-tag-${i}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <div className="text-xs font-semibold" data-testid="text-client-quick-links-title">
                        Quick links
                      </div>
                      <div className="mt-2 grid gap-2">
                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-client-open-enquiries"
                          onClick={() => setTab("enquiries")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Sparkles className="h-4 w-4" />
                              Enquiries
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-enquiries-hint">
                            {enquiries.length} enquir{enquiries.length === 1 ? "y" : "ies"} captured
                          </div>
                        </button>

                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-client-open-quotes"
                          onClick={() => setTab("quotes")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <FileText className="h-4 w-4" />
                              Quotes
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-quotes-hint">
                            Working versions, revisions, approvals
                          </div>
                        </button>

                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-client-open-booked"
                          onClick={() => setTab("booked")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Ticket className="h-4 w-4" />
                              Booked
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-booked-hint">
                            Confirmations, vouchers, timelines
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-3">
                  <div className="space-y-2" data-testid="panel-client-files">
                    {filteredFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
                        data-testid={`row-file-${f.id}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold" data-testid={`text-file-name-${f.id}`}>
                            {f.name}
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid={`text-file-meta-${f.id}`}>
                            {f.type} · Updated {f.updated}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <div className="space-y-2" data-testid="panel-client-tickets">
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center">
                        <div className="text-sm text-black/55">No tickets for this client.</div>
                      </div>
                    ) : (
                      filteredTickets.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-2xl border border-black/10 bg-white/70 p-3"
                          data-testid={`card-ticket-${t.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ticketTypePill(t.type)}`}>
                                  {t.type}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ticketStatusPill(t.status)}`}>
                                  {t.status}
                                </span>
                              </div>
                              <div className="text-xs font-semibold" data-testid={`text-ticket-title-${t.id}`}>
                                {t.subject}
                              </div>
                              <div className="mt-1 text-[11px] text-black/55" data-testid={`text-ticket-meta-${t.id}`}>
                                {getUserName(t.userId)} · {formatTicketDate(t.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-4 lg:col-span-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold" data-testid="text-client-right-title">
                  Client workspace
                </div>
                <div className="mt-1 text-xs text-black/55" data-testid="text-client-right-subtitle">Knowing you client is the key to Rapport</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-2xl bg-[#ff2f00e6] px-3 text-white hover:bg-[#ff2f00e6]/90"
                  data-testid="button-client-new-task"
                  onClick={() => { }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Add task
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                  data-testid="button-client-new-item"
                  onClick={() => { }}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-workspace">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
                <TabsList className="grid w-full grid-cols-6 rounded-2xl border border-black/10 bg-white/70">
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
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <ClientOverviewTab
                    clientData={clientData}
                    client={client}
                    enquiries={enquiries}
                    quotes={quotes}
                    bookings={bookings}
                    tickets={tickets}
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
                    onEditEnquiry={(enq) => {
                      setEditingEnquiry(enq);
                      setShowEnquiryWizard(true);
                    }}
                    onNewEnquiry={() => {
                      setEditingEnquiry(null);
                      setShowEnquiryWizard(true);
                    }}
                    onDeleteEnquiry={handleDeleteEnquiry}
                  />
                </TabsContent>

                <TabsContent value="quotes" className="mt-3">
                  <ClientQuotesTab
                    quotes={quotes}
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
                  />
                </TabsContent>

                <TabsContent value="files" className="mt-3">
                  <ClientFilesTab
                    uploadedFiles={uploadedFiles}
                    setUploadedFiles={setUploadedFiles}
                    filteredFiles={filteredFiles}
                    onUploadFile={() => setShowUploadFileModal(true)}
                    role={role}
                  />
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <ClientTicketsTab
                    filteredTickets={filteredTickets}
                    getUserName={getUserName}
                  />
                </TabsContent>

              </Tabs>
            </div>
          </Card>
        </div>
      </div>
      <QuoteCreateDialog
        transactionId={convertingFromEnquiryTxnId || ""}
        open={showQuoteCreateDialog && !!convertingFromEnquiryTxnId}
        onOpenChange={(open) => {
          if (!open) {
            setShowQuoteCreateDialog(false);
            setConvertingFromEnquiryTxnId(null);
            setConvertingEnquiryId(null);
          }
        }}
        onSuccess={() => {
          if (convertingEnquiryId) {
            updateEnquiryMutation.mutate({ id: convertingEnquiryId, data: { status: "Converted" } });
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
      <UploadFileDialog
        open={showUploadFileModal}
        onOpenChange={setShowUploadFileModal}
        clientName={client?.name || "this client"}
        quotes={quotes}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        onUpload={handleUploadFile}
      />
      <EditClientDialog
        open={showEditClient}
        onOpenChange={setShowEditClient}
        editForm={editForm}
        setEditForm={setEditForm}
        onSave={handleSaveClient}
        isPending={updateNeonClientMutation.isPending}
      />

      <EnquiryWizard
        open={showEnquiryWizard}
        onOpenChange={(open) => {
          setShowEnquiryWizard(open);
          if (!open) setEditingEnquiry(null);
        }}
        enquiry={editingEnquiry}
        onSubmit={handleEnquirySubmit}
        isSaving={createEnquiryMutation.isPending || updateEnquiryMutation.isPending}
      />
    </CommandCenterShell>
  );
}
