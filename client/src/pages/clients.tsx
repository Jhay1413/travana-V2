import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function shortInitials(name: string) {
  const parts = name
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "C";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

const seedClients: Client[] = [
  {
    id: "CL-10842",
    name: "Ava Harrington",
    tier: "Platinum",
    stage: "Booked",
    location: "Kensington, London",
    nextTrip: "Maldives · 9 nights · Overwater villa",
    value: 18450,
    lastTouch: "Today",
    email: "ava.harrington@example.com",
    phone: "+44 20 7946 0821",
    tags: ["Honeymoon", "VIP", "WhatsApp"],
  },
  {
    id: "CL-09117",
    name: "James Whitmore",
    tier: "Gold",
    stage: "Quote",
    location: "Edinburgh",
    nextTrip: "Japan · 12 nights · Kyoto + Tokyo",
    value: 12990,
    lastTouch: "2d",
    email: "james.whitmore@example.com",
    phone: "+44 131 496 2011",
    tags: ["Ski", "Family", "Email"],
  },
  {
    id: "CL-04301",
    name: "Noah Bennett",
    tier: "Standard",
    stage: "Enquiry",
    location: "Manchester",
    nextTrip: "Dubai · 5 nights · Weekend escape",
    value: 3990,
    lastTouch: "6d",
    email: "noah.bennett@example.com",
    phone: "+44 161 496 3102",
    tags: ["New", "Lead", "Call"],
  },
  {
    id: "CL-05528",
    name: "Sofia Clarke",
    tier: "Gold",
    stage: "Booked",
    location: "Bristol",
    nextTrip: "Bali · 10 nights · Private pool villa",
    value: 10450,
    lastTouch: "1d",
    email: "sofia.clarke@example.com",
    phone: "+44 117 496 7442",
    tags: ["Anniversary", "VIP", "Call"],
  },
  {
    id: "CL-07190",
    name: "Ethan Cole",
    tier: "Standard",
    stage: "Quote",
    location: "Leeds",
    nextTrip: "New York · 6 nights · Broadway",
    value: 5220,
    lastTouch: "4d",
    email: "ethan.cole@example.com",
    phone: "+44 113 496 5580",
    tags: ["Corporate", "Email"],
  },
  {
    id: "CL-06214",
    name: "Mia Sinclair",
    tier: "Platinum",
    stage: "Booked",
    location: "Chelsea, London",
    nextTrip: "St Lucia · 8 nights · Butler suite",
    value: 15690,
    lastTouch: "3d",
    email: "mia.sinclair@example.com",
    phone: "+44 20 7946 1141",
    tags: ["VIP", "Repeat", "WhatsApp"],
  },
];

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<Role>("Agent");
  const [active] = useState<string>("clients");

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | Stage>("all");
  const [tier, setTier] = useState<"all" | ClientTier>("all");
  const [sort, setSort] = useState<"value" | "lastTouch" | "name">("value");
  const [tab, setTab] = useState<"directory" | "segments">("directory");
  const [selectedId, setSelectedId] = useState<string>(seedClients[0]?.id ?? "");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = seedClients.filter((c) => {
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        c.location.toLowerCase().includes(query) ||
        c.nextTrip.toLowerCase().includes(query) ||
        c.tags.some((t) => t.toLowerCase().includes(query));

      const matchesStage = stage === "all" ? true : c.stage === stage;
      const matchesTier = tier === "all" ? true : c.tier === tier;
      return matchesQuery && matchesStage && matchesTier;
    });

    const s = [...base].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "lastTouch") {
        const rank = (v: string) => {
          if (v.toLowerCase() === "today") return 0;
          const m = v.match(/(\d+)d/i);
          if (m) return parseInt(m[1]!, 10);
          return 99;
        };
        return rank(a.lastTouch) - rank(b.lastTouch);
      }
      return b.value - a.value;
    });

    return s;
  }, [q, stage, tier, sort]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const totals = useMemo(() => {
    const booked = seedClients.filter((c) => c.stage === "Booked");
    const inPipe = seedClients.filter((c) => c.stage !== "Booked");
    const bookedValue = booked.reduce((s, i) => s + i.value, 0);
    const pipeValue = inPipe.reduce((s, i) => s + i.value, 0);
    return {
      total: seedClients.length,
      bookedCount: booked.length,
      pipelineCount: inPipe.length,
      bookedValue,
      pipeValue,
      avg: Math.round((bookedValue + pipeValue) / Math.max(seedClients.length, 1)),
    };
  }, []);

  return (
    <CommandCenterShell
      role={role}
      onRoleChange={setRole}
      active={active}
      title="Clients"
      subtitle="designed for high-signal selling"
      query={q}
      onQuery={setQ}
      theme="light"
      onToggleTheme={() => {}}
    >
      <div className="relative min-h-[calc(100vh-56px)] w-full px-4 pb-6 md:px-6 md:pb-8">

        <div className="relative mt-6 grid gap-3 md:grid-cols-5">
          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-4 md:col-span-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, ID, destination, tags…"
                    className="h-10 rounded-2xl border-black/10 bg-white/70 pl-10 pr-28 text-black placeholder:text-black/40"
                    data-testid="input-client-search"
                  />

                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 rounded-2xl border border-black/10 bg-black/[0.03] px-3 text-black hover:bg-black/[0.05]"
                      data-testid="button-import-clients"
                      onClick={() => {}}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-testid="group-client-filters">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                  data-testid="button-filter-toggle"
                  onClick={() => {}}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>

                <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-white/70 p-1">
                  {(["all", "Enquiry", "Quote", "Booked"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition " +
                        (stage === s ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.03]")
                      }
                      data-testid={`filter-stage-${s.toLowerCase()}`}
                      onClick={() => setStage(s as any)}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-white/70 p-1">
                  {(["all", "Platinum", "Gold", "Standard"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={
                        "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition " +
                        (tier === t ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.03]")
                      }
                      data-testid={`filter-tier-${t.toLowerCase()}`}
                      onClick={() => setTier(t as any)}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-white/70 p-1">
                  {([
                    { key: "value", label: "Value" },
                    { key: "lastTouch", label: "Touch" },
                    { key: "name", label: "Name" },
                  ] as const).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      className={
                        "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition " +
                        (sort === o.key ? "bg-black text-white" : "text-black/70 hover:bg-black/[0.03]")
                      }
                      data-testid={`filter-sort-${o.key}`}
                      onClick={() => setSort(o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3" data-testid="grid-client-kpis">
              <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-medium text-black/55" data-testid="label-kpi-total-clients">
                  Total clients
                </div>
                <div className="mt-2 text-2xl font-semibold" data-testid="value-kpi-total-clients">
                  {totals.total}
                </div>
              </div>
              <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-medium text-black/55" data-testid="label-kpi-booked">
                  Booked
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <div className="text-2xl font-semibold" data-testid="value-kpi-booked-count">
                    {totals.bookedCount}
                  </div>
                  <div className="text-xs font-semibold text-black/70" data-testid="value-kpi-booked-value">
                    {currency.format(totals.bookedValue)}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                <div className="text-xs font-medium text-black/55" data-testid="label-kpi-pipeline">
                  Pipeline
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <div className="text-2xl font-semibold" data-testid="value-kpi-pipeline-count">
                    {totals.pipelineCount}
                  </div>
                  <div className="text-xs font-semibold text-black/70" data-testid="value-kpi-pipeline-value">
                    {currency.format(totals.pipeValue)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="rounded-2xl border border-black/10 bg-white/70" data-testid="tabs-clients">
                  <TabsTrigger value="directory" className="rounded-xl" data-testid="tab-directory">
                    Directory
                  </TabsTrigger>
                  <TabsTrigger value="segments" className="rounded-xl" data-testid="tab-segments">
                    Segments
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="directory" className="mt-4">
                  <div className="grid gap-3" data-testid="list-client-results">
                    {filtered.map((c, idx) => {
                      const isSelected = selected?.id === c.id;
                      return (
                        <motion.button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={
                            "group w-full rounded-3xl border p-4 text-left transition active:scale-[0.99] " +
                            (isSelected
                              ? "border-black/15 bg-black/[0.03]"
                              : "border-black/10 bg-white/70 hover:bg-black/[0.03]")
                          }
                          data-testid={`row-client-${c.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24, delay: Math.min(idx * 0.02, 0.2) }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]"
                                  data-testid={`avatar-client-${c.id}`}
                                  aria-hidden
                                >
                                  <span className="text-xs font-semibold text-black/85">
                                    {shortInitials(c.name)}
                                  </span>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div
                                      className="truncate text-sm font-semibold"
                                      data-testid={`text-client-name-${c.id}`}
                                    >
                                      {c.name}
                                    </div>
                                    <span className="text-xs text-black/40" data-testid={`text-client-id-${c.id}`}>
                                      {c.id}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`rounded-full ${tierPill(c.tier)}`}
                                      data-testid={`pill-client-tier-${c.id}`}
                                    >
                                      {c.tier}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`rounded-full ${stagePill(c.stage)}`}
                                      data-testid={`status-client-stage-${c.id}`}
                                    >
                                      {c.stage}
                                    </Badge>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                    <span
                                      className="inline-flex items-center gap-1"
                                      data-testid={`text-client-location-${c.id}`}
                                    >
                                      <MapPin className="h-3.5 w-3.5" />
                                      {c.location}
                                    </span>
                                    <span className="text-black/25">•</span>
                                    <span className="truncate" data-testid={`text-client-nexttrip-${c.id}`}>
                                      {c.nextTrip}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {c.tags.slice(0, 3).map((t, i) => (
                                  <span
                                    key={t + i}
                                    className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                                    data-testid={`pill-client-tag-${c.id}-${i}`}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <div className="text-sm font-semibold text-black/90" data-testid={`text-client-value-${c.id}`}>
                                {currency.format(c.value)}
                              </div>
                              <div className="text-xs text-black/50" data-testid={`text-client-lasttouch-${c.id}`}>
                                Last touch: {c.lastTouch}
                              </div>
                              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-black/70">
                                Open
                                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}

                    {filtered.length === 0 ? (
                      <div
                        className="rounded-3xl border border-black/10 bg-white/70 p-8 text-center"
                        data-testid="empty-client-results"
                      >
                        <div
                          className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]"
                          aria-hidden
                        >
                          <Search className="h-5 w-5 text-black/70" />
                        </div>
                        <div className="mt-3 text-sm font-semibold" data-testid="text-empty-title">
                          No matches
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-empty-subtitle">
                          Try a different query or clear filters.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="segments" className="mt-4">
                  <div className="grid gap-3 md:grid-cols-2" data-testid="grid-client-segments">
                    {([
                      {
                        id: "seg-vip",
                        title: "VIP & Repeat",
                        desc: "High LTV clients with concierge expectations.",
                        icon: Star,
                        accent: "from-violet-500/20 via-black/[0.03] to-transparent",
                        count: 3,
                      },
                      {
                        id: "seg-family",
                        title: "Family Travel",
                        desc: "School-holiday led trips and multi-room bookings.",
                        icon: Users,
                        accent: "from-amber-500/20 via-black/[0.03] to-transparent",
                        count: 2,
                      },
                      {
                        id: "seg-corporate",
                        title: "Corporate",
                        desc: "Short lead times, tight itineraries, high margin upgrades.",
                        icon: BadgeCheck,
                        accent: "from-sky-500/20 via-black/[0.03] to-transparent",
                        count: 1,
                      },
                      {
                        id: "seg-new",
                        title: "New Leads",
                        desc: "Fast follow-up required to convert within 24 hours.",
                        icon: Sparkles,
                        accent: "from-fuchsia-500/20 via-black/[0.03] to-transparent",
                        count: 1,
                      },
                    ] as const).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white/70 p-5 text-left transition hover:bg-black/[0.03]"
                        data-testid={`card-segment-${s.id}`}
                        onClick={() => {}}
                      >
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent}`} />
                        <div className="relative flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]">
                              <s.icon className="h-5 w-5 text-black/70" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold" data-testid={`text-segment-title-${s.id}`}>
                                {s.title}
                              </div>
                              <div className="mt-1 text-xs text-black/55" data-testid={`text-segment-desc-${s.id}`}>
                                {s.desc}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-black/70" data-testid={`text-segment-count-${s.id}`}>
                            {s.count} clients
                          </div>
                        </div>
                        <div className="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-black/70">
                          View
                          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-4 md:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold" data-testid="text-client-panel-title">
                  Client panel
                </div>
                <div className="text-xs text-black/55" data-testid="text-client-panel-subtitle">
                  Select a client to view key details and actions.
                </div>
              </div>
              <div
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-black/70"
                data-testid="badge-selected-client"
              >
                <UserRound className="h-4 w-4" />
                {selected ? selected.id : "None"}
              </div>
            </div>

            <div className="mt-4 space-y-3" data-testid="panel-client-detail">
              {selected ? (
                <>
                  <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold" data-testid="text-selected-name">
                          {selected.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full ${tierPill(selected.tier)}`}
                            data-testid="pill-selected-tier"
                          >
                            {selected.tier}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`rounded-full ${stagePill(selected.stage)}`}
                            data-testid="status-selected-stage"
                          >
                            {selected.stage}
                          </Badge>
                          <span
                            className="inline-flex items-center gap-1 text-xs text-black/60"
                            data-testid="text-selected-location"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            {selected.location}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-black/55" data-testid="label-selected-value">
                          Deal value
                        </div>
                        <div className="mt-1 text-xl font-semibold" data-testid="text-selected-value">
                          {currency.format(selected.value)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2 text-xs text-black/70">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-black/55" data-testid="label-selected-nexttrip">
                            Next trip
                          </span>
                          <span className="inline-flex items-center gap-2 text-black/70" data-testid="value-selected-lasttouch">
                            <span className="text-black/40">Last touch</span>
                            {selected.lastTouch}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-black/85" data-testid="text-selected-nexttrip">
                          {selected.nextTrip}
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-action-call"
                          onClick={() => {}}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Phone className="h-4 w-4" />
                              Call
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 truncate text-xs text-black/55" data-testid="text-selected-phone">
                            {selected.phone}
                          </div>
                        </button>

                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-action-email"
                          onClick={() => {}}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Mail className="h-4 w-4" />
                              Email
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 truncate text-xs text-black/55" data-testid="text-selected-email">
                            {selected.email}
                          </div>
                        </button>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-action-add-task"
                          onClick={() => {}}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Calendar className="h-4 w-4" />
                              Add task
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-xs text-black/55" data-testid="text-action-task-hint">
                            Follow up, reminders, deadlines
                          </div>
                        </button>

                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-action-add-note"
                          onClick={() => {}}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <BadgeCheck className="h-4 w-4" />
                              Add note
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-xs text-black/55" data-testid="text-action-note-hint">
                            Log preferences, requests, constraints
                          </div>
                        </button>
                      </div>

                      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                        <div className="text-xs font-semibold text-black/80" data-testid="text-selected-tags-title">
                          Tags
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2" data-testid="list-selected-tags">
                          {selected.tags.map((t, i) => (
                            <span
                              key={t + i}
                              className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                              data-testid={`pill-selected-tag-${i}`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
                    <div className="text-sm font-semibold" data-testid="text-timeline-title">
                      Recent timeline
                    </div>
                    <div className="mt-3 space-y-2" data-testid="list-timeline">
                      {([
                        {
                          id: "t1",
                          title: "Quote revised and re-sent",
                          meta: `Value updated to ${currency.format(selected.value)} · Sent via email`,
                        },
                        {
                          id: "t2",
                          title: "Preferences logged",
                          meta: "No red-eye flights · Late checkout preferred",
                        },
                        {
                          id: "t3",
                          title: "Follow-up scheduled",
                          meta: "Tomorrow 10:00 · Reminder set",
                        },
                      ] as const).map((it) => (
                        <div
                          key={it.id}
                          className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
                          data-testid={`row-timeline-${it.id}`}
                        >
                          <div className="text-xs font-semibold text-black/85" data-testid={`text-timeline-title-${it.id}`}>
                            {it.title}
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid={`text-timeline-meta-${it.id}`}>
                            {it.meta}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-black/10 bg-white/70 p-10 text-center" data-testid="empty-client-panel">
                  <div
                    className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]"
                    aria-hidden
                  >
                    <UserRound className="h-5 w-5 text-black/70" />
                  </div>
                  <div className="mt-3 text-sm font-semibold" data-testid="text-empty-panel-title">
                    No client selected
                  </div>
                  <div className="mt-1 text-xs text-black/55" data-testid="text-empty-panel-subtitle">
                    Choose a client from the directory to view details.
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </CommandCenterShell>
  );
}
