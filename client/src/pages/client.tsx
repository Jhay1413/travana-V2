import { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
  Search,
  X,
  UserCheck,
  Users,
  LayoutDashboard,
  MessageSquare,
  Folder,
  Crown,
  Plane,
  TrendingUp,
  CircleDollarSign,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNeonClient, useNeonClients, useTransactions, useTicketsByClient, useUsers, useCurrentUser } from "@/hooks/queries";
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

import { tierPill, transformNeonClientData, transformTicket, formatTicketDate, ticketStatusPill, ticketTypePill, filesFor, currency } from "@/components/client/client-types";
import type { BookingWithJoins } from "@/components/client/client-types";
import { EditClientDialog } from "@/components/client/EditClientDialog";
import { UploadFileDialog } from "@/components/client/UploadFileDialog";
import type { Client as ApiClient } from "@/types/client";
import { QuoteCreateDialog } from "@/components/quote-create-dialog";
import { BookingCreateDialog } from "@/components/booking-create-dialog";
import { ClientOverviewTab, PortalPinSection } from "@/components/client/ClientOverviewTab";
import { ClientEnquiriesTab } from "@/components/client/ClientEnquiriesTab";
import { ClientQuotesTab } from "@/components/client/ClientQuotesTab";
import { ClientBookedTab } from "@/components/client/ClientBookedTab";
import { ClientFilesTab } from "@/components/client/ClientFilesTab";
import { ClientTicketsTab } from "@/components/client/ClientTicketsTab";
import { ClientVipClubTab } from "@/components/client/ClientVipClubTab";

// ── ReferrerSelector ────────────────────────────────────────────────────────

function ReferrerSelector({
  currentReferredByClientId,
  excludeClientId,
  onSelect,
  onClear,
}: {
  currentReferredByClientId: string | null | undefined;
  excludeClientId: string;
  onSelect: (clientId: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch current referrer name
  const { data: currentReferrer } = useNeonClient(currentReferredByClientId ?? "");

  // Search results
  const { data: searchResults } = useNeonClients({
    search: debouncedSearch,
    limit: 8,
  });

  const results = (searchResults?.clients ?? []).filter((c) => c.id !== excludeClientId);

  function handleSelect(client: { id: string; firstName: string; surename: string }) {
    onSelect(client.id);
    setOpen(false);
    setSearch("");
    setDebouncedSearch("");
  }

  if (currentReferredByClientId && currentReferrer) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-3 py-2">
        <UserCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-black/40">Referred by</p>
          <p className="truncate text-xs font-semibold text-black/80">
            {currentReferrer.firstName} {currentReferrer.surename}
            {currentReferrer.phoneNumber && (
              <span className="ml-1.5 font-normal text-black/40">{currentReferrer.phoneNumber}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-black/40 transition hover:bg-red-500/10 hover:text-red-600"
          title="Remove referrer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-3 py-1.5 text-xs font-medium text-black/40 transition hover:border-black/25 hover:bg-black/[0.04] hover:text-black/60"
        >
          <Users className="h-3.5 w-3.5" />
          Set referrer
        </button>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-black/30" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-black/80 placeholder:text-black/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setOpen(false); setSearch(""); }}
              className="text-black/30 hover:text-black/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {results.length > 0 && (
            <ul className="max-h-48 divide-y divide-black/5 overflow-y-auto border-t border-black/5">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                    onClick={() => handleSelect(c)}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                      <UserRound className="h-3.5 w-3.5 text-black/40" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-black/80">
                        {c.firstName} {c.surename}
                      </p>
                      <p className="truncate text-[10px] text-black/40">{c.phoneNumber}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {debouncedSearch && results.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-black/30">No clients found</p>
          )}

          {!debouncedSearch && results.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-black/30">Start typing to search</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ClientPage ───────────────────────────────────────────────────────────────

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const { toast } = useToast();

  const { role, setRole } = useRole();
  const [active] = useState<string>("clients");
  const [q, setQ] = useState("");
  type ClientTab = "overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets" | "vip-club";
  const validTabs: ClientTab[] = ["overview", "enquiries", "quotes", "booked", "files", "tickets", "vip-club"];
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
          is_test: data.is_test === true,
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
            notes: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : undefined,
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
  const bookings = useMemo(() => transactions.flatMap((t: Transaction) => t.booking ? [{ ...t.booking, user_id: t.user_id }] : []), [transactions]);

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
      <div className="relative min-h-[calc(100vh-56px)] w-full" data-testid="layout-client-page">

        {/* ═══════════════════════ CINEMATIC HERO BAND ═══════════════════════ */}
        <section className="relative overflow-hidden">
          {/* Layered gradient backdrop with floating orbs + subtle grid */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-br from-[#fbf7f1] via-white to-sky-50/70" />
            <div className="absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-amber-200/45 via-rose-200/25 to-transparent blur-3xl" />
            <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-gradient-to-br from-sky-300/35 via-violet-300/25 to-transparent blur-3xl" />
            <div className="absolute right-1/4 -bottom-24 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />
            <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(0,0,0,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.5)_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent" />
          </div>

          <div className="relative px-4 pt-5 pb-8 md:px-8 md:pb-10">
            {/* Top action bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("/clients")}
                className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/85 px-3.5 py-2 text-xs font-semibold text-black/75 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.18)] backdrop-blur transition hover:-translate-x-0.5 hover:bg-white"
                data-testid="button-back-clients"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to clients
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
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[0_4px_12px_-6px_rgba(15,23,42,0.18)] backdrop-blur transition ${isClientPinned ? "border-amber-400/40 bg-gradient-to-br from-amber-400/25 to-amber-500/10 text-amber-800 hover:from-amber-400/35" : "border-black/[0.08] bg-white/85 text-black/75 hover:bg-white"}`}
                  data-testid="button-pin-client"
                >
                  {isClientPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {isClientPinned ? "Pinned" : "Pin to dashboard"}
                </button>
                <button
                  type="button"
                  onClick={openEditDialog}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.5)] transition hover:bg-slate-800"
                  data-testid="button-edit-client"
                >
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </button>
              </div>
            </div>

            {/* Identity block */}
            <div className="mt-7 flex flex-col items-start gap-6 md:flex-row md:items-end md:gap-8" data-testid="card-client-summary">
              <div className="relative shrink-0">
                <div className="absolute -inset-2.5 rounded-[2rem] bg-gradient-to-br from-amber-400/40 via-rose-400/30 to-violet-400/40 blur-xl" aria-hidden />
                <div
                  className="relative inline-flex h-24 w-24 items-center justify-center rounded-3xl border border-white/80 bg-gradient-to-br from-white via-sky-50 to-violet-50 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] md:h-28 md:w-28"
                  data-testid="avatar-client"
                  aria-hidden
                >
                  {client ? (
                    <span className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
                      {client.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("") || "·"}
                    </span>
                  ) : (
                    <UserRound className="h-10 w-10 text-black/40" />
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="h-px w-6 bg-gradient-to-r from-amber-500/70 to-transparent" aria-hidden />
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-700/80">Client Profile</div>
                </div>
                <h1
                  className="mt-2 break-words text-3xl font-bold leading-[1.05] tracking-tight text-slate-900 md:text-5xl"
                  data-testid="text-client-name"
                >
                  {client ? client.name : "Client"}
                </h1>
                {client ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Select
                      value={clientData?.badge || "New Client"}
                      onValueChange={(value) => {
                        if (clientId) {
                          updateNeonClientMutation.mutate({ id: clientId, data: { badge: value } });
                        }
                      }}
                    >
                      <SelectTrigger
                        className="h-auto w-auto rounded-full border-[#3b82f6]/30 bg-white/85 px-3 py-1 text-xs font-semibold text-[#3b82f6] shadow-sm backdrop-blur hover:bg-white"
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
                      className={`gap-1 rounded-full backdrop-blur ${tierPill(client.tier)}`}
                      data-testid="pill-client-tier"
                    >
                      <Crown className="h-3 w-3" />
                      {client.tier}
                    </Badge>
                    {clientData?.email && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-[11px] font-medium text-black/70 backdrop-blur">
                        <Mail className="h-3 w-3" />
                        {clientData.email}
                      </span>
                    )}
                    {clientData?.phoneNumber && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-[11px] font-medium text-black/70 backdrop-blur">
                        <Phone className="h-3 w-3" />
                        {clientData.phoneNumber}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Inline metric ribbon */}
            {(() => {
              const bookedProfit = bookings.reduce(
                (s: number, b: BookingWithJoins) => s + parseFloat(b.package_commission || "0"),
                0
              );
              const metrics = [
                { icon: Inbox, label: "Enquiries", value: String(enquiries.length), accent: "from-sky-500/15 to-sky-500/5", icColor: "text-sky-700", barColor: "from-sky-500 to-sky-400" },
                { icon: Sparkles, label: "Quotes", value: String(quotes.length), accent: "from-violet-500/15 to-violet-500/5", icColor: "text-violet-700", barColor: "from-violet-500 to-fuchsia-400" },
                { icon: Plane, label: "Bookings", value: String(bookings.length), accent: "from-emerald-500/15 to-emerald-500/5", icColor: "text-emerald-700", barColor: "from-emerald-500 to-teal-400" },
                { icon: CircleDollarSign, label: "Booked profit", value: currency.format(bookedProfit), accent: "from-amber-500/15 to-amber-500/5", icColor: "text-amber-700", barColor: "from-amber-500 to-rose-400" },
              ];
              return (
                <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {metrics.map((m) => {
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.label}
                        className={`group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-br ${m.accent} p-4 backdrop-blur transition hover:border-black/[0.12] hover:shadow-lg`}
                      >
                        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${m.barColor}`} />
                        <div className="flex items-center justify-between">
                          <div className={`grid h-8 w-8 place-items-center rounded-xl bg-white/85 ${m.icColor} shadow-sm`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <TrendingUp className="h-3.5 w-3.5 text-black/30" />
                        </div>
                        <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-black/55">{m.label}</div>
                        <div className="mt-0.5 truncate text-2xl font-bold tracking-tight text-slate-900">{m.value}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>

        {/* ═══════════════════════ STICKY TAB BAR ═══════════════════════ */}
        <div className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl">
          <div className="px-4 md:px-8" data-testid="tabs-client-workspace">
            <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
              <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-8 md:px-8 [&::-webkit-scrollbar]:hidden">
                <TabsList className="inline-flex h-auto w-max gap-1 bg-transparent p-0 py-2.5">
                  {[
                    { value: "overview", label: "Overview", icon: LayoutDashboard },
                    { value: "enquiries", label: "Enquiries", icon: MessageSquare },
                    { value: "quotes", label: "Quotes", icon: Sparkles },
                    { value: "booked", label: "Booked", icon: Plane },
                    { value: "files", label: "Files", icon: Folder },
                    { value: "tickets", label: "Tickets", icon: Ticket },
                    { value: "vip-club", label: "VIP Club", icon: Crown },
                  ].map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      data-testid={`tab-${value}`}
                      className="group inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-black/55 transition hover:bg-black/[0.04] hover:text-black/85 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-[0_8px_22px_-10px_rgba(15,23,42,0.55)]"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ═══════════════════════ BODY GRID ═══════════════════════ */}
              <div className="grid gap-6 py-6 lg:grid-cols-12">
                {/* WORKSPACE — main content area */}
                <div className="min-w-0 lg:col-span-8">
                  <TabsContent value="overview" className="mt-0">
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

                  <TabsContent value="enquiries" className="mt-0">
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

                  <TabsContent value="quotes" className="mt-0">
                    <ClientQuotesTab
                      quotes={quotes}
                      bookings={bookings}
                      transactions={transactions}
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

                  <TabsContent value="booked" className="mt-0">
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

                  <TabsContent value="files" className="mt-0">
                    <ClientFilesTab
                      clientFiles={clientFilesData}
                      onDeleteFile={(id) => deleteFileMutation.mutate(id)}
                      filteredFiles={filteredFiles}
                      onUploadFile={() => setShowUploadFileModal(true)}
                      role={role}
                    />
                  </TabsContent>

                  <TabsContent value="tickets" className="mt-0">
                    <ClientTicketsTab
                      filteredTickets={filteredTickets}
                      getUserName={getUserName}
                    />
                  </TabsContent>

                  <TabsContent value="vip-club" className="mt-0">
                    <ClientVipClubTab clientId={clientId} />
                  </TabsContent>
                </div>

                {/* IDENTITY RAIL — right sidebar (sticky on desktop) */}
                <aside className="lg:col-span-4">
                  <div className="space-y-3 lg:sticky lg:top-20">
                    <div className="flex items-center gap-2 px-1">
                      <span className="h-px w-5 bg-gradient-to-r from-amber-500/70 to-transparent" aria-hidden />
                      <div
                        className="text-[10px] font-bold uppercase tracking-[0.25em] text-black/60"
                        data-testid="text-client-right-title"
                      >
                        Identity
                      </div>
                    </div>
                    <div
                      className="px-1 text-[11px] text-black/45"
                      data-testid="text-client-right-subtitle"
                    >
                      Knowing your client is the key to rapport
                    </div>

                    {/* Contact + Address */}
                    <div
                      className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.22)] backdrop-blur"
                      data-testid="section-contact-details"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] bg-gradient-to-r from-slate-50 via-white to-white px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
                            <Phone className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold tracking-tight text-black/85">Contact</div>
                            <div className="text-[10px] text-black/50">Reach this client</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openEditDialog}
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-black/65 shadow-sm transition hover:bg-white"
                          data-testid="button-edit-contact"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      </div>

                      <div className="space-y-1.5 p-3" data-testid="list-contact-details">
                        {clientData?.phoneNumber && (
                          <div className="group flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition hover:border-blue-500/30 hover:bg-blue-50/40">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 text-blue-600">
                              <Phone className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-black/40" data-testid="label-contact-phone">Phone</div>
                              <div className="truncate text-sm font-medium text-black/85" data-testid="value-contact-phone">
                                <a href={`tel:${clientData.phoneNumber.replace(/\s/g, '')}`} className="transition-colors hover:text-blue-600">
                                  {clientData.phoneNumber}
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {clientData?.email && (
                          <div className="group flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition hover:border-emerald-500/30 hover:bg-emerald-50/40">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600">
                              <Mail className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-black/40" data-testid="label-contact-email">Email</div>
                              <div className="truncate text-sm font-medium text-black/85" data-testid="value-contact-email">
                                <a href={`mailto:${clientData.email}`} className="transition-colors hover:text-emerald-600">
                                  {clientData.email}
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {clientData?.DOB && (
                          <div className="group flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition hover:border-purple-500/30 hover:bg-purple-50/40">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 text-purple-600">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-black/40" data-testid="label-contact-dob">Date of Birth</div>
                              <div className="text-sm font-medium text-black/85" data-testid="value-contact-dob">
                                {clientData.DOB}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {(clientData?.houseNumber || clientData?.street || clientData?.city || clientData?.post_code || clientData?.country) && (
                        <>
                          <div className="flex items-center gap-2.5 border-y border-black/[0.06] bg-gradient-to-r from-rose-50/60 via-white to-white px-4 py-3">
                            <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-600 text-white shadow-sm">
                              <Home className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold tracking-tight text-black/85">Address</div>
                              <div className="text-[10px] text-black/50">Where they're based</div>
                            </div>
                          </div>

                          <div className="space-y-1.5 p-3" data-testid="list-address-details">
                            {(clientData?.houseNumber || clientData?.street) && (
                              <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition hover:border-rose-500/30 hover:bg-rose-50/40">
                                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 text-rose-600">
                                  <Home className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-black/40" data-testid="label-address-street">Street</div>
                                  <div className="text-sm font-medium text-black/85" data-testid="value-address-street">
                                    {[clientData.houseNumber, clientData.street].filter(Boolean).join(" ")}
                                  </div>
                                </div>
                              </div>
                            )}

                            {(clientData?.city || clientData?.post_code) && (
                              <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition hover:border-sky-500/30 hover:bg-sky-50/40">
                                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500/15 to-sky-500/5 text-sky-600">
                                  <MapPin className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-black/40" data-testid="label-address-city">City &amp; Postcode</div>
                                  <div className="text-sm font-medium text-black/85" data-testid="value-address-city">
                                    {[clientData.city, clientData.post_code].filter(Boolean).join(", ")}
                                  </div>
                                </div>
                              </div>
                            )}

                            {clientData?.country && (
                              <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 transition hover:border-indigo-500/30 hover:bg-indigo-50/40">
                                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 text-indigo-600">
                                  <MapPin className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-black/40" data-testid="label-address-country">Country</div>
                                  <div className="text-sm font-medium text-black/85" data-testid="value-address-country">
                                    {clientData.country}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Referrer card */}
                    <div className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.22)] backdrop-blur">
                      <div className="flex items-center gap-2.5 border-b border-black/[0.06] bg-gradient-to-r from-violet-50/60 via-white to-white px-4 py-3">
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
                          <UserCheck className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold tracking-tight text-black/85">Referred by</div>
                          <div className="text-[10px] text-black/50">Track your referral chain</div>
                        </div>
                      </div>
                      <div className="p-3">
                        <ReferrerSelector
                          currentReferredByClientId={clientData?.referredByClientId}
                          excludeClientId={clientId}
                          onSelect={(referredByClientId) => {
                            updateNeonClientMutation.mutate(
                              { id: clientId, data: { referredByClientId } },
                              { onSuccess: () => toast({ title: "Referrer saved" }), onError: () => toast({ title: "Failed to save referrer", variant: "destructive" }) }
                            );
                          }}
                          onClear={() => {
                            updateNeonClientMutation.mutate(
                              { id: clientId, data: { referredByClientId: null } },
                              { onSuccess: () => toast({ title: "Referrer removed" }), onError: () => toast({ title: "Failed to remove referrer", variant: "destructive" }) }
                            );
                          }}
                        />
                      </div>
                    </div>

                    {/* Portal access card */}
                    <div className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.22)] backdrop-blur">
                      <PortalPinSection clientId={clientId} />
                    </div>
                  </div>
                </aside>
              </div>
            </Tabs>
          </div>
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
