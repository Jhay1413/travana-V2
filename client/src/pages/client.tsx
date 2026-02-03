import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plane,
  Search,
  Sparkles,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchClient, fetchQuotes, fetchTicketsByClient, fetchUsers, createTicket, updateTicket, updateClient as apiUpdateClient, type Client as ApiClient, type Quote as ApiQuote, type Ticket as ApiTicket, type User as ApiUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Stage = "Enquiry" | "Quote" | "Booked";

type ClientTier = "Platinum" | "Gold" | "Standard";

type Client = {
  id: string;
  name: string;
  tier: ClientTier;
  stage: Stage;
  location: string;
  nextTrip: string;
  value: number;
  lastTouch: string;
  email: string;
  phone: string;
  tags: string[];
};

type TicketItem = {
  id: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  userId: string;
};

type FileItem = {
  id: string;
  name: string;
  type: "PDF" | "DOC" | "IMG";
  updated: string;
};

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function tierPill(tier: ClientTier) {
  switch (tier) {
    case "Platinum":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Gold":
      return "border-amber-500/25 bg-amber-500/10 text-amber-800";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function stagePill(stage: Stage) {
  switch (stage) {
    case "Booked":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800";
    case "Quote":
      return "border-sky-500/25 bg-sky-500/10 text-sky-800";
    default:
      return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800";
  }
}

function transformClientData(apiData: ApiClient): Client {
  return {
    id: apiData.id,
    name: apiData.name,
    tier: apiData.tier as ClientTier,
    stage: apiData.stage as Stage,
    location: apiData.location || "",
    nextTrip: apiData.nextTrip || "",
    value: parseFloat(apiData.value || "0"),
    lastTouch: apiData.lastTouch || "",
    email: apiData.email,
    phone: apiData.phone,
    tags: apiData.tags,
  };
}

function transformTicket(ticket: ApiTicket): TicketItem {
  return {
    id: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    userId: ticket.userId,
  };
}

function formatTicketDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ticketStatusPill(status: string) {
  switch (status) {
    case "Open":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    case "In Progress":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
    case "Resolved":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    case "Closed":
      return "border-black/10 bg-black/[0.03] text-black/70";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function ticketTypePill(type: string) {
  switch (type) {
    case "Admin":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Build":
      return "border-sky-500/25 bg-sky-500/10 text-sky-700";
    case "Sales":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function filesFor(clientId: string): FileItem[] {
  return [
    { id: `${clientId}-F1`, name: "Passport scan", type: "IMG", updated: "Today" },
    { id: `${clientId}-F2`, name: "Quote v3", type: "PDF", updated: "2d" },
    { id: `${clientId}-F3`, name: "Itinerary draft", type: "DOC", updated: "6d" },
  ];
}

type QuotePassenger = {
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
};

type QuoteFlightLeg = {
  departAirport: string;
  departCity: string;
  departDate: string;
  departTime: string;
  arriveAirport: string;
  arriveCity: string;
  arriveDate: string;
  arriveTime: string;
};

type QuoteCommission = {
  tourOperator: string;
  sales: number;
  price: number;
  commission: number;
  discount: number;
  serviceCharge: number;
  pricePerPerson: number;
};

type Quote = {
  id: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  images: { id: string; label: string }[];
  travelDate: string;
  passengers: QuotePassenger;
  country: string;
  destination: string;
  resort: string;
  accommodation: string;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  boardBasis: string;
  roomType: string;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  flights: {
    outbound: QuoteFlightLeg;
    inbound: QuoteFlightLeg;
  };
  commissions: QuoteCommission;
  jsonPayload: string;
};

function safeJsonParse(value: string): { ok: true; data: any } | { ok: false; error: string } {
  try {
    const data = JSON.parse(value);
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Invalid JSON" };
  }
}

function formatPax(p: QuotePassenger) {
  const parts: string[] = [];
  parts.push(`${p.adults} adult${p.adults === 1 ? "" : "s"}`);
  if (p.children > 0) parts.push(`${p.children} child${p.children === 1 ? "" : "ren"}`);
  if (p.infants > 0) parts.push(`${p.infants} infant${p.infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function computePaxTotal(p: QuotePassenger) {
  return p.adults + p.children + p.infants;
}

function formatUKDate(value: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const seedQuote: Quote = {
  id: "Q-00038",
  packageType: "Package (Flight + Hotel)",
  quoteTitle: "Maldives — Overwater Villa, 9 nights",
  quoteLink: "https://example.com/quotes/Q-00038",
  images: [
    { id: "img-hero", label: "Resort hero" },
    { id: "img-room", label: "Room" },
    { id: "img-beach", label: "Beach" },
  ],
  travelDate: "2026-04-12",
  passengers: { adults: 2, children: 1, infants: 0, childAges: [7] },
  country: "United Kingdom",
  destination: "Maldives",
  resort: "North Malé Atoll",
  accommodation: "Azure Overwater Resort",
  checkInDate: "2026-04-12",
  checkInTime: "15:00",
  nights: 9,
  boardBasis: "Half Board",
  roomType: "Overwater Villa",
  transferType: "Seaplane",
  preBookedSeats: "Extra legroom (row 12)",
  flightMeals: "Standard + child meal",
  flights: {
    outbound: {
      departAirport: "LHR",
      departCity: "London Heathrow",
      departDate: "2026-04-12",
      departTime: "21:10",
      arriveAirport: "MLE",
      arriveCity: "Malé",
      arriveDate: "2026-04-13",
      arriveTime: "11:55",
    },
    inbound: {
      departAirport: "MLE",
      departCity: "Malé",
      departDate: "2026-04-22",
      departTime: "09:15",
      arriveAirport: "LHR",
      arriveCity: "London Heathrow",
      arriveDate: "2026-04-22",
      arriveTime: "18:05",
    },
  },
  commissions: {
    tourOperator: "Luxury Escapes UK",
    sales: 18450,
    price: 18450,
    commission: 1380,
    discount: 250,
    serviceCharge: 120,
    pricePerPerson: 6150,
  },
  jsonPayload: JSON.stringify(
    {
      quoteId: "Q-00038",
      packageType: "Package (Flight + Hotel)",
      destination: "Maldives",
      pax: { adults: 2, children: [{ age: 7 }], infants: 0 },
      room: { type: "Overwater Villa", board: "Half Board" },
      transfers: "Seaplane",
    },
    null,
    2,
  ),
};

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const { toast } = useToast();

  const [role, setRole] = useState<Role>("Agent");
  const [active] = useState<string>("clients");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets" | "tags">(
    "overview",
  );
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
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
  const [newQuote, setNewQuote] = useState({
    packageType: "",
    quoteTitle: "",
    quoteLink: "",
    jsonPayload: "",
    travelDate: "",
    passengersAdults: 2,
    passengersChildren: 0,
    passengersInfants: 0,
    childAges: [] as number[],
    country: "",
    destination: "",
    resort: "",
    accommodation: "",
    checkInDate: "",
    checkInTime: "",
    nights: 7,
    boardBasis: "",
    roomType: "",
    transferType: "",
    preBookedSeats: "",
    flightMeals: "",
    outboundDepartAirport: "",
    outboundDepartDate: "",
    outboundDepartTime: "",
    outboundArriveAirport: "",
    outboundArriveDate: "",
    outboundArriveTime: "",
    inboundDepartAirport: "",
    inboundDepartDate: "",
    inboundDepartTime: "",
    inboundArriveAirport: "",
    inboundArriveDate: "",
    inboundArriveTime: "",
    tourOperator: "",
    sales: 0,
    price: 0,
    commission: 0,
    discount: 0,
    serviceCharge: 0,
    pricePerPerson: 0,
  });
  const queryClient = useQueryClient();

  const clientId = params?.clientId ?? "";

  const { data: clientData, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient(clientId),
    enabled: !!clientId,
  });

  const { data: quotesData, isLoading: isLoadingQuotes } = useQuery({
    queryKey: ["quotes", "client", clientId],
    queryFn: () => fetchQuotes({ clientId }),
    enabled: !!clientId,
  });

  const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
    queryKey: ["tickets", "client", clientId],
    queryFn: () => fetchTicketsByClient(clientId),
    enabled: !!clientId,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ApiClient> }) => apiUpdateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
    },
    onError: () => {
      toast({ title: "Failed to update client", variant: "destructive" });
    },
  });

  const client = useMemo(() => {
    if (!clientData) return null;
    return transformClientData(clientData);
  }, [clientData]);

  const quotes = useMemo(() => quotesData || [], [quotesData]);

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
        onToggleTheme={() => {}}
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
        onToggleTheme={() => {}}
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
      onToggleTheme={() => {}}
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
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-client-summary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3" data-testid="text-client-name">
                    <span className="text-lg font-semibold">{client ? client.name : "Client"}</span>
                    {client?.phone && (
                      <span className="text-sm font-bold text-[#000000c4]" data-testid="text-client-phone-header">
                        {client.phone}
                      </span>
                    )}
                  </div>
                  {client ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select
                        value={clientData?.clientType || "New Client"}
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
                    <div className="text-[11px] font-semibold text-black/55" data-testid="label-client-next-trip">
                      Next trip
                    </div>
                    <div className="mt-0.5 text-sm text-black/85" data-testid="value-client-next-trip">
                      {client.nextTrip}
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

              {client ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2" data-testid="grid-client-actions">
                  <button
                    type="button"
                    className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                    data-testid="button-client-call"
                    onClick={() => {}}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                        <Phone className="h-4 w-4" />
                        Call
                      </span>
                      <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-1 truncate text-xs text-black/55" data-testid="text-client-phone">
                      {client.phone}
                    </div>
                  </button>

                  <button
                    type="button"
                    className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                    data-testid="button-client-email"
                    onClick={() => {}}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                        <Mail className="h-4 w-4" />
                        Email
                      </span>
                      <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-1 truncate text-xs text-black/55" data-testid="text-client-email">
                      {client.email}
                    </div>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-sections">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
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
                          onClick={() => {}}
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
                            New leads and requirements captured
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
                  onClick={() => {}}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Add task
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                  data-testid="button-client-new-item"
                  onClick={() => {}}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-workspace">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid w-full grid-cols-6 rounded-2xl border border-black/10 bg-white/70">
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
                  <TabsTrigger value="tags" className="rounded-xl" data-testid="tab-tags">
                    Tags
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="enquiries" className="mt-3">
                  <div className="grid gap-3" data-testid="list-enquiries">
                    {["Initial requirements", "Budget alignment", "Destination short-list"].map((title, idx) => (
                      <motion.div
                        key={title}
                        className="rounded-3xl border border-black/10 bg-white/70 p-4"
                        data-testid={`card-enquiry-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18) }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" data-testid={`text-enquiry-title-${idx}`}>
                              {title}
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-enquiry-meta-${idx}`}>
                              Captured {idx === 0 ? "Today" : idx === 1 ? "2d" : "6d"} · Assigned to you
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="quotes" className="mt-3">
                  <div className="grid gap-3" data-testid="layout-quotes">
                    <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quotes-list">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" data-testid="text-quotes-title">
                            Quotes
                          </div>
                          <div className="mt-1 text-xs text-black/55" data-testid="text-quotes-subtitle">
                            Quick view of recent quotes for this client.
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                          data-testid="button-quotes-new"
                          onClick={() => setShowNewQuoteModal(true)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          New quote
                        </Button>
                      </div>

                      <div className="mt-4 space-y-2" data-testid="section-quotes-groups">
                        {[
                          {
                            id: "in-play",
                            title: "In Play",
                            rows: quotes
                              .filter((q) => q.status === "In Play")
                              .map((q) => ({
                                id: q.id,
                                title: q.quoteTitle || `${q.destination} Trip`,
                                destination: q.destination,
                                travelDate: q.travelDate,
                                createdAt: new Date(q.createdAt).toLocaleDateString("en-GB"),
                                tourOperator: q.packageType || "—",
                                totalCost: 0,
                              })),
                          },
                          {
                            id: "won",
                            title: "Won",
                            rows: quotes
                              .filter((q) => q.status === "Won")
                              .map((q) => ({
                                id: q.id,
                                title: q.quoteTitle || `${q.destination} Trip`,
                                destination: q.destination,
                                travelDate: q.travelDate,
                                createdAt: new Date(q.createdAt).toLocaleDateString("en-GB"),
                                tourOperator: q.packageType || "—",
                                totalCost: 0,
                              })),
                          },
                          {
                            id: "lost",
                            title: "Lost",
                            rows: quotes
                              .filter((q) => q.status === "Lost")
                              .map((q) => ({
                                id: q.id,
                                title: q.quoteTitle || `${q.destination} Trip`,
                                destination: q.destination,
                                travelDate: q.travelDate,
                                createdAt: new Date(q.createdAt).toLocaleDateString("en-GB"),
                                tourOperator: q.packageType || "—",
                                totalCost: 0,
                              })),
                          },
                        ].map((group) => (
                          <div key={group.id} className="rounded-3xl border border-black/10 bg-white/60 p-2" data-testid={`group-quotes-${group.id}`}>
                            <div className="flex items-center justify-between gap-3 px-2 py-2" data-testid={`row-quotes-group-header-${group.id}`}>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-semibold text-black/80" data-testid={`text-quotes-group-title-${group.id}`}>
                                  {group.title}
                                </div>
                                <span
                                  className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/60"
                                  data-testid={`pill-quotes-group-count-${group.id}`}
                                >
                                  {group.rows.length}
                                </span>
                              </div>
                            </div>

                            <div className="grid gap-2" data-testid={`list-quotes-${group.id}`}>
                              {group.rows.map((q) => (
                                <button
                                  key={q.id}
                                  type="button"
                                  className="group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99]"
                                  data-testid={`card-quote-intro-${q.id}`}
                                  onClick={() => window.open(`/clients/${clientId}/quotes/${q.id}`, "_self")}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.05] via-white/30 to-transparent"
                                      data-testid={`img-quote-${q.id}`}
                                      aria-hidden
                                    >
                                      <img
                                        src="/attached_assets/Luxury-Coco-Beach-Resort.jpg"
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                        data-testid={`img-quote-photo-${q.id}`}
                                      />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-semibold" data-testid={`text-quote-title-${q.id}`}>
                                            {q.title}
                                          </div>
                                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                            <span data-testid={`text-quote-destination-${q.id}`}>{q.destination}</span>
                                            <span className="text-black/25">•</span>
                                            <span data-testid={`text-quote-traveldate-${q.id}`}>{formatUKDate(q.travelDate)}</span>
                                            <span className="text-black/25">•</span>
                                            <span data-testid={`text-quote-created-${q.id}`}>Created {q.createdAt}</span>
                                          </div>
                                          <div className="mt-1 text-xs text-black/60" data-testid={`text-quote-operator-${q.id}`}>
                                            Tour operator: <span className="font-semibold text-black/80">{q.tourOperator}</span>
                                          </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                          <div className="text-xs font-semibold text-black/85" data-testid={`text-quote-total-${q.id}`}>
                                            {currency.format(q.totalCost)}
                                          </div>
                                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-black/60" data-testid={`button-view-quote-${q.id}`}>
                                            View
                                            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}

                              {group.rows.length === 0 ? (
                                <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid={`empty-quotes-${group.id}`}>
                                  <div className="text-sm font-semibold" data-testid={`text-empty-quotes-title-${group.id}`}>
                                    No quotes
                                  </div>
                                  <div className="mt-1 text-xs text-black/55" data-testid={`text-empty-quotes-subtitle-${group.id}`}>
                                    Nothing in {group.title.toLowerCase()} yet.
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                  </div>
                </TabsContent>

                <TabsContent value="booked" className="mt-3">
                  <div className="grid gap-3" data-testid="list-booked">
                    {["Hotel confirmation", "Transfers", "Activities"].map((title, idx) => (
                      <div
                        key={title}
                        className="rounded-3xl border border-black/10 bg-white/70 p-4"
                        data-testid={`card-booked-${idx}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" data-testid={`text-booked-title-${idx}`}>
                              {title}
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-booked-meta-${idx}`}>
                              Status: {client?.stage === "Booked" ? "Confirmed" : "Draft"} · Updated {idx === 0 ? "Today" : idx === 1 ? "3d" : "1w"}
                            </div>
                          </div>
                          <Ticket className="h-4 w-4 text-black/35" aria-hidden />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-3">
                  <Card className="rounded-3xl border-black/10 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-files-title">
                          Files
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-files-subtitle">
                          Upload and manage client documents.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                        data-testid="button-files-upload"
                        onClick={() => setShowUploadFileModal(true)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Upload File
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3" data-testid="list-files">
                      {uploadedFiles.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => window.open(f.url, '_blank')}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99]"
                          data-testid={`row-file-uploaded-${f.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold" data-testid={`text-file-uploaded-name-${f.id}`}>
                                {f.title}
                              </div>
                              <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                {f.category}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-file-uploaded-meta-${f.id}`}>
                              {f.type} · {f.name} · {f.allocationType !== "None" ? `${f.allocationType}` : "Client level"} · {f.updated}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                        </button>
                      ))}
                      {filteredFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3"
                          data-testid={`row-file-wide-${f.id}`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold" data-testid={`text-file-wide-name-${f.id}`}>
                              {f.name}
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-file-wide-meta-${f.id}`}>
                              {f.type} · Updated {f.updated}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                        </div>
                      ))}
                      {filteredFiles.length === 0 && uploadedFiles.length === 0 && (
                        <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center">
                          <div className="text-sm text-black/55">No files uploaded yet.</div>
                        </div>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <div className="grid gap-3" data-testid="list-tickets">
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-3xl border border-black/10 bg-white/60 p-6 text-center">
                        <div className="text-sm text-black/55">No tickets for this client.</div>
                        <p className="text-xs text-black/40 mt-1">Create a ticket from the Tickets page.</p>
                      </div>
                    ) : (
                      filteredTickets.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-3xl border border-black/10 bg-white/70 p-4"
                          data-testid={`card-ticket-wide-${t.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ticketTypePill(t.type)}`}>
                                  {t.type}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ticketStatusPill(t.status)}`}>
                                  {t.status}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/60">
                                  {t.priority}
                                </span>
                              </div>
                              <div className="text-sm font-semibold truncate" data-testid={`text-ticket-wide-title-${t.id}`}>
                                {t.subject}
                              </div>
                              {t.description && (
                                <div className="mt-1 text-xs text-black/60 line-clamp-2">{t.description}</div>
                              )}
                              <div className="mt-2 text-xs text-black/50" data-testid={`text-ticket-wide-meta-${t.id}`}>
                                Assigned to {getUserName(t.userId)} · {formatTicketDate(t.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="tags" className="mt-3">
                  <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="panel-tags">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-tags-title">
                          Tags
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-tags-subtitle">
                          Maintain consistent tagging across clients.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-2xl border border-black/10 bg-black/[0.03] px-3 text-black hover:bg-black/[0.05]"
                        data-testid="button-tags-add"
                        onClick={() => {}}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Add tag
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2" data-testid="list-tags">
                      {(client?.tags ?? []).map((t, i) => (
                        <span
                          key={t + i}
                          className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                          data-testid={`pill-tag-${i}`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>
      </div>
      <Dialog open={showNewQuoteModal} onOpenChange={setShowNewQuoteModal}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">New Quote</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              Create a new quote for {client?.name || "this client"}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-6">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold">Package Details</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Package Type</Label>
                  <Select value={newQuote.packageType} onValueChange={(v) => setNewQuote({ ...newQuote, packageType: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-package-type">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Package (Flight + Hotel)">Package (Flight + Hotel)</SelectItem>
                      <SelectItem value="Flight Only">Flight Only</SelectItem>
                      <SelectItem value="Hotel Only">Hotel Only</SelectItem>
                      <SelectItem value="Cruise">Cruise</SelectItem>
                      <SelectItem value="Tour">Tour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Quote Title</Label>
                  <Input
                    placeholder="e.g. Maldives — Overwater Villa, 9 nights"
                    value={newQuote.quoteTitle}
                    onChange={(e) => setNewQuote({ ...newQuote, quoteTitle: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-quote-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Quote Link</Label>
                  <Input
                    placeholder="https://..."
                    value={newQuote.quoteLink}
                    onChange={(e) => setNewQuote({ ...newQuote, quoteLink: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-quote-link"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">JSON Upload</Label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const content = ev.target?.result as string || "";
                          const toIsoDate = (d: string | undefined): string => {
                            if (!d) return "";
                            const match = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                            if (match) {
                              const [, day, month, year] = match;
                              return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                            }
                            return d;
                          };
                          try {
                            const data = JSON.parse(content);
                            setNewQuote((prev) => ({
                              ...prev,
                              jsonPayload: content,
                              packageType: data.packageType || data.package_type || prev.packageType,
                              quoteTitle: data.quoteTitle || data.quote_title || data.title || prev.quoteTitle,
                              quoteLink: data.quoteLink || data.quote_link || data.link || prev.quoteLink,
                              travelDate: toIsoDate(data.travelDate || data.travel_date || data.departureDate) || prev.travelDate,
                              passengersAdults: data.passengers?.adults || data.adults || data.passengersAdults || prev.passengersAdults,
                              passengersChildren: data.passengers?.children || data.children || data.passengersChildren || prev.passengersChildren,
                              passengersInfants: data.passengers?.infants || data.infants || data.passengersInfants || prev.passengersInfants,
                              childAges: data.childAges || data.child_ages || data.passengers?.childAges || prev.childAges,
                              country: data.country || prev.country,
                              destination: data.destination || prev.destination,
                              resort: data.resort || prev.resort,
                              accommodation: data.accommodation || data.hotel || data.property || prev.accommodation,
                              checkInDate: toIsoDate(data.checkInDate || data.check_in_date || data.checkin) || prev.checkInDate,
                              checkInTime: data.checkInTime || data.check_in_time || prev.checkInTime,
                              nights: data.nights || data.duration || prev.nights,
                              boardBasis: data.boardBasis || data.board_basis || data.board || prev.boardBasis,
                              roomType: data.roomType || data.room_type || data.room || prev.roomType,
                              transferType: data.transferType || data.transfer_type || data.transfers || prev.transferType,
                              preBookedSeats: data.preBookedSeats || data.pre_booked_seats || data.seats || prev.preBookedSeats,
                              flightMeals: data.flightMeals || data.flight_meals || data.meals || prev.flightMeals,
                              outboundDepartAirport: data.flights?.outbound?.departAirport || data.outbound?.from || data.departureAirport || prev.outboundDepartAirport,
                              outboundDepartDate: toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date) || prev.outboundDepartDate,
                              outboundDepartTime: data.flights?.outbound?.departTime || data.outbound?.time || prev.outboundDepartTime,
                              outboundArriveAirport: data.flights?.outbound?.arriveAirport || data.outbound?.to || data.arrivalAirport || prev.outboundArriveAirport,
                              outboundArriveDate: toIsoDate(data.flights?.outbound?.arriveDate) || prev.outboundArriveDate,
                              outboundArriveTime: data.flights?.outbound?.arriveTime || prev.outboundArriveTime,
                              inboundDepartAirport: data.flights?.inbound?.departAirport || data.inbound?.from || prev.inboundDepartAirport,
                              inboundDepartDate: toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date) || prev.inboundDepartDate,
                              inboundDepartTime: data.flights?.inbound?.departTime || data.inbound?.time || prev.inboundDepartTime,
                              inboundArriveAirport: data.flights?.inbound?.arriveAirport || data.inbound?.to || prev.inboundArriveAirport,
                              inboundArriveDate: toIsoDate(data.flights?.inbound?.arriveDate) || prev.inboundArriveDate,
                              inboundArriveTime: data.flights?.inbound?.arriveTime || prev.inboundArriveTime,
                              tourOperator: data.commissions?.tourOperator || data.tourOperator || data.tour_operator || data.operator || prev.tourOperator,
                              sales: data.commissions?.sales || data.sales || prev.sales,
                              price: data.commissions?.price || data.price || data.total || prev.price,
                              commission: data.commissions?.commission || data.commission || prev.commission,
                              discount: data.commissions?.discount || data.discount || prev.discount,
                              serviceCharge: data.commissions?.serviceCharge || data.serviceCharge || data.service_charge || prev.serviceCharge,
                              pricePerPerson: data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp || prev.pricePerPerson,
                            }));
                          } catch {
                            setNewQuote((prev) => ({ ...prev, jsonPayload: content }));
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-json-upload"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold">Travel Details</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                  <Input
                    type="date"
                    value={newQuote.travelDate}
                    onChange={(e) => setNewQuote({ ...newQuote, travelDate: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-travel-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuote.passengersAdults}
                    onChange={(e) => setNewQuote({ ...newQuote, passengersAdults: parseInt(e.target.value) || 1 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-adults"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.passengersChildren}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setNewQuote({ ...newQuote, passengersChildren: count, childAges: Array(count).fill(0) });
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-children"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Infants</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.passengersInfants}
                    onChange={(e) => setNewQuote({ ...newQuote, passengersInfants: parseInt(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-infants"
                  />
                </div>
                {newQuote.passengersChildren > 0 && (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                    <div className="flex flex-wrap gap-2">
                      {newQuote.childAges.map((age, idx) => (
                        <Input
                          key={idx}
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const ages = [...newQuote.childAges];
                            ages[idx] = parseInt(e.target.value) || 0;
                            setNewQuote({ ...newQuote, childAges: ages });
                          }}
                          className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-child-age-${idx}`}
                          placeholder={`Child ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold">Destination & Accommodation</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Country</Label>
                  <Input
                    placeholder="e.g. United Kingdom"
                    value={newQuote.country}
                    onChange={(e) => setNewQuote({ ...newQuote, country: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-country"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Destination</Label>
                  <Input
                    placeholder="e.g. Maldives"
                    value={newQuote.destination}
                    onChange={(e) => setNewQuote({ ...newQuote, destination: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-destination"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Resort</Label>
                  <Input
                    placeholder="e.g. North Malé Atoll"
                    value={newQuote.resort}
                    onChange={(e) => setNewQuote({ ...newQuote, resort: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-resort"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Accommodation</Label>
                  <Input
                    placeholder="e.g. Azure Overwater Resort"
                    value={newQuote.accommodation}
                    onChange={(e) => setNewQuote({ ...newQuote, accommodation: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-accommodation"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                  <Input
                    type="date"
                    value={newQuote.checkInDate}
                    onChange={(e) => setNewQuote({ ...newQuote, checkInDate: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-checkin-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Time</Label>
                  <Input
                    type="time"
                    value={newQuote.checkInTime}
                    onChange={(e) => setNewQuote({ ...newQuote, checkInTime: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-checkin-time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuote.nights}
                    onChange={(e) => setNewQuote({ ...newQuote, nights: parseInt(e.target.value) || 1 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-nights"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                  <Select value={newQuote.boardBasis} onValueChange={(v) => setNewQuote({ ...newQuote, boardBasis: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-board-basis">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Room Only">Room Only</SelectItem>
                      <SelectItem value="Bed & Breakfast">Bed & Breakfast</SelectItem>
                      <SelectItem value="Half Board">Half Board</SelectItem>
                      <SelectItem value="Full Board">Full Board</SelectItem>
                      <SelectItem value="All Inclusive">All Inclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Room Type</Label>
                  <Input
                    placeholder="e.g. Overwater Villa"
                    value={newQuote.roomType}
                    onChange={(e) => setNewQuote({ ...newQuote, roomType: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-room-type"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Transfer Type</Label>
                  <Select value={newQuote.transferType} onValueChange={(v) => setNewQuote({ ...newQuote, transferType: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-transfer-type">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Private Transfer">Private Transfer</SelectItem>
                      <SelectItem value="Shared Transfer">Shared Transfer</SelectItem>
                      <SelectItem value="Seaplane">Seaplane</SelectItem>
                      <SelectItem value="Speedboat">Speedboat</SelectItem>
                      <SelectItem value="Self-drive">Self-drive</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Pre-booked Seats</Label>
                  <Input
                    placeholder="e.g. Extra legroom (row 12)"
                    value={newQuote.preBookedSeats}
                    onChange={(e) => setNewQuote({ ...newQuote, preBookedSeats: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-prebooked-seats"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Flight Meals</Label>
                  <Input
                    placeholder="e.g. Standard + child meal"
                    value={newQuote.flightMeals}
                    onChange={(e) => setNewQuote({ ...newQuote, flightMeals: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-flight-meals"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Plane className="h-4 w-4" />
                Flights — Outbound
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                  <Input
                    placeholder="e.g. LHR"
                    value={newQuote.outboundDepartAirport}
                    onChange={(e) => setNewQuote({ ...newQuote, outboundDepartAirport: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-outbound-depart-airport"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                  <Input
                    type="date"
                    value={newQuote.outboundDepartDate}
                    onChange={(e) => setNewQuote({ ...newQuote, outboundDepartDate: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-outbound-depart-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                  <Input
                    type="time"
                    value={newQuote.outboundDepartTime}
                    onChange={(e) => setNewQuote({ ...newQuote, outboundDepartTime: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-outbound-depart-time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                  <Input
                    placeholder="e.g. MLE"
                    value={newQuote.outboundArriveAirport}
                    onChange={(e) => setNewQuote({ ...newQuote, outboundArriveAirport: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-outbound-arrive-airport"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                  <Input
                    type="date"
                    value={newQuote.outboundArriveDate}
                    onChange={(e) => setNewQuote({ ...newQuote, outboundArriveDate: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-outbound-arrive-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                  <Input
                    type="time"
                    value={newQuote.outboundArriveTime}
                    onChange={(e) => setNewQuote({ ...newQuote, outboundArriveTime: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-outbound-arrive-time"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Plane className="h-4 w-4 rotate-180" />
                Flights — Inbound
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                  <Input
                    placeholder="e.g. MLE"
                    value={newQuote.inboundDepartAirport}
                    onChange={(e) => setNewQuote({ ...newQuote, inboundDepartAirport: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-inbound-depart-airport"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                  <Input
                    type="date"
                    value={newQuote.inboundDepartDate}
                    onChange={(e) => setNewQuote({ ...newQuote, inboundDepartDate: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-inbound-depart-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                  <Input
                    type="time"
                    value={newQuote.inboundDepartTime}
                    onChange={(e) => setNewQuote({ ...newQuote, inboundDepartTime: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-inbound-depart-time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                  <Input
                    placeholder="e.g. LHR"
                    value={newQuote.inboundArriveAirport}
                    onChange={(e) => setNewQuote({ ...newQuote, inboundArriveAirport: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-inbound-arrive-airport"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                  <Input
                    type="date"
                    value={newQuote.inboundArriveDate}
                    onChange={(e) => setNewQuote({ ...newQuote, inboundArriveDate: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-inbound-arrive-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                  <Input
                    type="time"
                    value={newQuote.inboundArriveTime}
                    onChange={(e) => setNewQuote({ ...newQuote, inboundArriveTime: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-inbound-arrive-time"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold">Package Commissions</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
                  <Input
                    placeholder="e.g. Luxury Escapes UK"
                    value={newQuote.tourOperator}
                    onChange={(e) => setNewQuote({ ...newQuote, tourOperator: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-tour-operator"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Sales (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.sales}
                    onChange={(e) => setNewQuote({ ...newQuote, sales: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-sales"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Price (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.price}
                    onChange={(e) => setNewQuote({ ...newQuote, price: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-price"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Commission (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.commission}
                    onChange={(e) => setNewQuote({ ...newQuote, commission: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-commission"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Discount (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.discount}
                    onChange={(e) => setNewQuote({ ...newQuote, discount: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-discount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Service Charge (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.serviceCharge}
                    onChange={(e) => setNewQuote({ ...newQuote, serviceCharge: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-service-charge"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Price per Person (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.pricePerPerson}
                    onChange={(e) => setNewQuote({ ...newQuote, pricePerPerson: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-price-per-person"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-2xl border-black/10 px-4"
                onClick={() => setShowNewQuoteModal(false)}
                data-testid="button-cancel-quote"
              >
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
                onClick={() => {
                  setShowNewQuoteModal(false);
                }}
                data-testid="button-save-quote"
              >
                Create Quote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showUploadFileModal} onOpenChange={setShowUploadFileModal}>
        <DialogContent className="max-w-lg rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Upload File</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              Upload a document and categorise it for {client?.name || "this client"}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Select File</Label>
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile((prev) => ({ ...prev, file }));
                }}
                className="h-10 rounded-xl border-black/10 bg-white/70"
                data-testid="input-upload-file"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Title</Label>
              <Input
                placeholder="e.g. Family Passport Scans"
                value={uploadFile.title}
                onChange={(e) => setUploadFile((prev) => ({ ...prev, title: e.target.value }))}
                className="h-10 rounded-xl border-black/10 bg-white/70"
                data-testid="input-upload-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">File Type</Label>
              <Select
                value={uploadFile.fileType}
                onValueChange={(v) => setUploadFile((prev) => ({ ...prev, fileType: v }))}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-file-type">
                  <SelectValue placeholder="Select file type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Passport">Passport</SelectItem>
                  <SelectItem value="Tickets">Tickets</SelectItem>
                  <SelectItem value="Quote">Quote</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Itinerary">Itinerary</SelectItem>
                  <SelectItem value="Insurance">Insurance</SelectItem>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Allocate To</Label>
              <Select
                value={uploadFile.allocationType}
                onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationType: v, allocationId: "" }))}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-allocation-type">
                  <SelectValue placeholder="Select allocation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enquiry">Enquiry</SelectItem>
                  <SelectItem value="Quote">Quote</SelectItem>
                  <SelectItem value="Booking">Booking</SelectItem>
                  <SelectItem value="None">None (Client level)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadFile.allocationType === "Quote" && quotes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Select Quote</Label>
                <Select
                  value={uploadFile.allocationId}
                  onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationId: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-quote-allocation">
                    <SelectValue placeholder="Select quote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {quotes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.quoteTitle || q.destination} - {q.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {uploadFile.allocationType === "Enquiry" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Select Enquiry</Label>
                <Select
                  value={uploadFile.allocationId}
                  onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationId: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-enquiry-allocation">
                    <SelectValue placeholder="Select enquiry..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enquiry-1">Initial requirements</SelectItem>
                    <SelectItem value="enquiry-2">Budget alignment</SelectItem>
                    <SelectItem value="enquiry-3">Destination short-list</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {uploadFile.allocationType === "Booking" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Select Booking</Label>
                <Select
                  value={uploadFile.allocationId}
                  onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationId: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-booking-allocation">
                    <SelectValue placeholder="Select booking..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking-1">Hotel confirmation</SelectItem>
                    <SelectItem value="booking-2">Transfers</SelectItem>
                    <SelectItem value="booking-3">Activities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                className="rounded-2xl border-black/10 px-4"
                onClick={() => {
                  setShowUploadFileModal(false);
                  setUploadFile({ file: null, fileType: "", allocationType: "", allocationId: "" });
                }}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
                disabled={!uploadFile.file || !uploadFile.fileType}
                onClick={() => {
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
                }}
                data-testid="button-upload-file"
              >
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}
