import { useMemo, useState, useCallback, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { clientFileApi } from "@/api";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Mail,
  MapPin,
  Home,
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
import { useUpdateClient, useUpdateNeonClient, useCreateEnquiry, useUpdateEnquiry, useDeleteEnquiry, useCreateTransaction, useCreateTicket, useCreateTask } from "@/hooks/mutations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const validTabs: ClientTab[] = ["overview", "enquiries", "quotes", "booked", "files", "tickets"];
  const [tab, setTab] = useState<ClientTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as ClientTab | null;
    return t && validTabs.includes(t) ? t : "overview";
  });
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
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", dueTime: "09:00" });
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", type: "Task", priority: "Medium", description: "" });
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
  const clientId = params?.clientId ?? "";
  const queryClient = useQueryClient();
  const { data: clientFilesData = [] } = useQuery({
    queryKey: ["client-files", clientId],
    queryFn: () => clientFileApi.getByClient(clientId),
    enabled: !!clientId,
  });
  const uploadFileMutation = useMutation({
    mutationFn: (params: { file: File; title?: string; category?: string; allocationType?: string; allocationId?: string }) =>
      clientFileApi.upload(clientId, params.file, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
      toast({ title: "File uploaded", description: "File saved successfully." });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
    },
  });
  const deleteFileMutation = useMutation({
    mutationFn: (id: string) => clientFileApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
      toast({ title: "File deleted" });
    },
  });

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const create = params.get("create");
    if (create === "enquiry") setShowEnquiryWizard(true);
    else if (create === "quote") setShowQuoteCreateDialog(true);
    else if (create === "booking") setShowBookingCreateDialog(true);
    else if (create === "task") setShowTaskDialog(true);
    else if (create === "ticket") setShowTicketDialog(true);
  }, []);

  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryTable | null>(null);
  const createEnquiryMutation = useCreateEnquiry();
  const updateEnquiryMutation = useUpdateEnquiry();
  const deleteEnquiryMutation = useDeleteEnquiry();
  const createTransactionMutation = useCreateTransaction();
  const createTicketMutation = useCreateTicket();
  const createTaskMutation = useCreateTask("client", clientId || "");

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

  const handleNewQuote = () => {
    setShowQuoteCreateDialog(true);
  };

  const handleConvertEnquiryToQuote = (enq: EnquiryTable) => {
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
  };

  const handleUploadFile = () => {
    if (uploadFile.file) {
      uploadFileMutation.mutate({
        file: uploadFile.file,
        title: uploadFile.title || uploadFile.file.name,
        category: uploadFile.fileType,
        allocationType: uploadFile.allocationType || undefined,
        allocationId: uploadFile.allocationId || undefined,
      });
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
      filterSlot={<></>}
      createActions={[
        { label: "Enquiry", icon: <FileText className="h-4 w-4" />, onClick: () => setShowEnquiryWizard(true) },
        { label: "Quote", icon: <Sparkles className="h-4 w-4" />, onClick: handleNewQuote },
        { label: "Booking", icon: <Calendar className="h-4 w-4" />, onClick: () => setShowBookingCreateDialog(true) },
        { label: "Task", icon: <Ticket className="h-4 w-4" />, onClick: () => setShowTaskDialog(true) },
      ]}
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
              <div className="flex items-center gap-3" data-testid="text-client-name">
                <div
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]"
                  aria-hidden
                  data-testid="avatar-client"
                >
                  <UserRound className="h-5 w-5 text-black/70" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="text-lg font-semibold">{client ? client.name : "Client"}</span>
                  </div>
                  {client ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
              </div>


            </div>

            <div className="mt-3 rounded-3xl border border-black/10 bg-white/60 p-3" data-testid="section-contact-details">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-black/80">Contact Details</div>
                <button
                  type="button"
                  onClick={openEditDialog}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] font-semibold text-black/60 hover:bg-black/[0.05] transition"
                  data-testid="button-edit-contact"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </div>
              <div className="grid gap-2" data-testid="list-contact-details">
                <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
                    <Phone className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-phone">Phone</div>
                    <div className="truncate text-sm text-black/85" data-testid="value-contact-phone">
                      {clientData?.phoneNumber ? (
                        <a href={`tel:${clientData.phoneNumber.replace(/\s/g, '')}`} className="hover:text-blue-600 transition-colors">
                          {clientData.phoneNumber}
                        </a>
                      ) : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/10">
                    <Mail className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-email">Email</div>
                    <div className="truncate text-sm text-black/85" data-testid="value-contact-email">
                      {clientData?.email ? (
                        <a href={`mailto:${clientData.email}`} className="hover:text-green-600 transition-colors">
                          {clientData.email}
                        </a>
                      ) : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10">
                    <UserRound className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-dob">Date of Birth</div>
                    <div className="text-sm text-black/85" data-testid="value-contact-dob">
                      {clientData?.DOB || "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                    <BadgeCheck className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-preferences">Preferences</div>
                    <div className="mt-1 flex flex-wrap gap-1.5" data-testid="value-contact-preferences">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${clientData?.whatsAppVerified ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-black/10 bg-black/[0.03] text-black/50"}`}>
                        WhatsApp {clientData?.whatsAppVerified ? "✓" : "✗"}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${clientData?.emailIsAllowed ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-black/10 bg-black/[0.03] text-black/50"}`}>
                        Email {clientData?.emailIsAllowed ? "✓" : "✗"}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${clientData?.mailAllowed ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-black/10 bg-black/[0.03] text-black/50"}`}>
                        Mail {clientData?.mailAllowed ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 mb-2">
                <div className="text-xs font-semibold text-black/80">Address</div>
              </div>
              <div className="grid gap-2" data-testid="list-address-details">
                <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 mt-0.5">
                    <Home className="h-4 w-4 text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-address-street">Street</div>
                    <div className="text-sm text-black/85" data-testid="value-address-street">
                      {[clientData?.houseNumber, clientData?.street].filter(Boolean).join(" ") || "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 mt-0.5">
                    <MapPin className="h-4 w-4 text-sky-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-address-city">City & Postcode</div>
                    <div className="text-sm text-black/85" data-testid="value-address-city">
                      {[clientData?.city, clientData?.post_code].filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 mt-0.5">
                    <MapPin className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-black/50" data-testid="label-address-country">Country</div>
                    <div className="text-sm text-black/85" data-testid="value-address-country">
                      {clientData?.country || "—"}
                    </div>
                  </div>
                </div>
              </div>
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
              
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-workspace">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 rounded-2xl border border-black/10 bg-white/70">
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
                    bookings={bookings}
                    clientId={clientId}
                    navigate={navigate}
                    onNewQuote={handleNewQuote}
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
                    clientFiles={clientFilesData}
                    onDeleteFile={(id) => deleteFileMutation.mutate(id)}
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

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="z-[500] max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">Task <span className="text-red-500">*</span></Label>
              <Input
                id="task-title"
                placeholder="What needs to be done?"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="task-due-date">Due Date <span className="text-red-500">*</span></Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="rounded-2xl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-due-time">Due Time</Label>
                <Input
                  id="task-due-time"
                  type="time"
                  value={taskForm.dueTime}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueTime: e.target.value }))}
                  className="rounded-2xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              disabled={!taskForm.title.trim() || !taskForm.dueDate || createTaskMutation.isPending}
              onClick={() => {
                if (!taskForm.title.trim() || !taskForm.dueDate || !currentUser?.id) return;
                const dueDate = new Date(`${taskForm.dueDate}T${taskForm.dueTime || "09:00"}`);
                createTaskMutation.mutate(
                  {
                    entityType: "client",
                    entityId: clientId,
                    userId: currentUser.id,
                    title: taskForm.title.trim(),
                    dueDate: dueDate,
                    completed: false,
                    notified: false,
                  },
                  {
                    onSuccess: () => {
                      toast({ title: "Task created" });
                      setShowTaskDialog(false);
                      setTaskForm({ title: "", dueDate: "", dueTime: "09:00" });
                    },
                    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
                  }
                );
              }}
            >
              {createTaskMutation.isPending ? "Creating…" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="z-[500] max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Ticket</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ticket-subject">Subject <span className="text-red-500">*</span></Label>
              <Input
                id="ticket-subject"
                placeholder="What needs to be done?"
                value={ticketForm.subject}
                onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ticket-type">Type</Label>
                <Select value={ticketForm.type} onValueChange={(v) => setTicketForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger id="ticket-type" className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[600]">
                    <SelectItem value="Task">Task</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ticket-priority">Priority</Label>
                <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger id="ticket-priority" className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[600]">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ticket-description">Description</Label>
              <Textarea
                id="ticket-description"
                placeholder="Optional notes…"
                rows={3}
                value={ticketForm.description}
                onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-2xl resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setShowTicketDialog(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              disabled={!ticketForm.subject.trim() || createTicketMutation.isPending}
              onClick={() => {
                if (!ticketForm.subject.trim() || !currentUser?.id) return;
                createTicketMutation.mutate(
                  {
                    clientId,
                    userId: currentUser.id,
                    type: ticketForm.type,
                    status: "Open",
                    priority: ticketForm.priority,
                    subject: ticketForm.subject.trim(),
                    description: ticketForm.description.trim() || null,
                  },
                  {
                    onSuccess: () => {
                      toast({ title: "Ticket created" });
                      setShowTicketDialog(false);
                      setTicketForm({ subject: "", type: "Task", priority: "Medium", description: "" });
                    },
                    onError: () => toast({ title: "Failed to create ticket", variant: "destructive" }),
                  }
                );
              }}
            >
              {createTicketMutation.isPending ? "Creating…" : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
