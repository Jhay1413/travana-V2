import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Search,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { fetchClient, fetchQuotes, type Client as ApiClient, type Quote as ApiQuote } from "@/lib/api";

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
  title: string;
  status: "Open" | "Pending" | "Resolved";
  updated: string;
  channel: "Email" | "Call" | "WhatsApp";
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

function ticketsFor(clientId: string): TicketItem[] {
  const base: TicketItem[] = [
    {
      id: `${clientId}-T1`,
      title: "Flight options confirmation",
      status: "Pending",
      updated: "Today",
      channel: "Email",
    },
    {
      id: `${clientId}-T2`,
      title: "Hotel upgrade request",
      status: "Open",
      updated: "2d",
      channel: "WhatsApp",
    },
    {
      id: `${clientId}-T3`,
      title: "Insurance policy query",
      status: "Resolved",
      updated: "1w",
      channel: "Call",
    },
  ];
  return base;
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

  const [role, setRole] = useState<Role>("Agent");
  const [active] = useState<string>("clients");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets" | "tags">(
    "overview",
  );

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

  const client = useMemo(() => {
    if (!clientData) return null;
    return transformClientData(clientData);
  }, [clientData]);

  const quotes = useMemo(() => quotesData || [], [quotesData]);

  const tickets = useMemo(() => (client ? ticketsFor(client.id) : []), [client]);
  const files = useMemo(() => (client ? filesFor(client.id) : []), [client]);

  const filteredTickets = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((t) =>
      `${t.id} ${t.title} ${t.status} ${t.updated} ${t.channel}`.toLowerCase().includes(query),
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
        subtitle="Loading..."
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
        subtitle="Not found"
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
      subtitle={`${client.id} · ${client.location}`}
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
              <Button
                className="rounded-2xl bg-black text-white hover:bg-black/90"
                data-testid="button-client-new-task"
                onClick={() => {}}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Add task
              </Button>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-client-summary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold" data-testid="text-client-name">
                    {client ? client.name : "Client"}
                  </div>
                  <div className="mt-1 text-xs text-black/55" data-testid="text-client-meta">
                    {client ? `${client.id} · ${client.location}` : "No client selected"}
                  </div>
                  {client ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full ${tierPill(client.tier)}`}
                        data-testid="pill-client-tier"
                      >
                        {client.tier}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${stagePill(client.stage)}`}
                        data-testid="status-client-stage"
                      >
                        {client.stage}
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
                    <div className="text-[11px] font-semibold text-black/55" data-testid="label-client-deal-value">
                      Deal value
                    </div>
                    <div className="mt-0.5 text-sm font-semibold" data-testid="value-client-deal-value">
                      {currency.format(client.value)}
                    </div>
                  </div>
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
                                ? "border-black/15 bg-black text-white"
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
                    {filteredTickets.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-black/10 bg-white/70 p-3"
                        data-testid={`card-ticket-${t.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold" data-testid={`text-ticket-title-${t.id}`}>
                              {t.title}
                            </div>
                            <div className="mt-1 text-[11px] text-black/55" data-testid={`text-ticket-meta-${t.id}`}>
                              {t.id} · {t.channel} · Updated {t.updated}
                            </div>
                          </div>
                          <span
                            className={
                              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                              (t.status === "Resolved"
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800"
                                : t.status === "Pending"
                                  ? "border-amber-500/25 bg-amber-500/10 text-amber-800"
                                  : "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800")
                            }
                            data-testid={`status-ticket-${t.id}`}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
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
                <div className="mt-1 text-xs text-black/55" data-testid="text-client-right-subtitle">
                  Enquiries, quotes, booked items, files, tickets, and tags — all in one place.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 rounded-2xl border border-black/10 bg-white/70 px-3 text-black hover:bg-black/[0.03]"
                  data-testid="button-client-filter"
                  onClick={() => {}}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
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
                          onClick={() => {}}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          New quote
                        </Button>
                      </div>

                      <div className="mt-4" data-testid="section-quotes-groups">
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
                  <div className="grid gap-3" data-testid="list-files">
                    {filteredFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white/70 p-4"
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
                  </div>
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <div className="grid gap-3" data-testid="list-tickets">
                    {filteredTickets.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-3xl border border-black/10 bg-white/70 p-4"
                        data-testid={`card-ticket-wide-${t.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" data-testid={`text-ticket-wide-title-${t.id}`}>
                              {t.title}
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-ticket-wide-meta-${t.id}`}>
                              {t.id} · {t.channel} · Updated {t.updated}
                            </div>
                          </div>
                          <span
                            className={
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                              (t.status === "Resolved"
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800"
                                : t.status === "Pending"
                                  ? "border-amber-500/25 bg-amber-500/10 text-amber-800"
                                  : "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800")
                            }
                            data-testid={`status-ticket-wide-${t.id}`}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
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
    </CommandCenterShell>
  );
}
