import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronRight,
  Globe,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type Stage = "Enquiry" | "Quote" | "Booked";

type Client = {
  id: string;
  name: string;
  tier: "Platinum" | "Gold" | "Standard";
  nextTrip: string;
  location: string;
  stage: Stage;
  value: number;
  lastTouch: string;
};

type Activity = {
  id: string;
  time: string;
  label: string;
  meta: string;
  type: "call" | "email" | "note" | "task";
};

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function stagePill(stage: Stage) {
  if (stage === "Booked") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  if (stage === "Quote") return "bg-sky-500/15 text-sky-200 border-sky-500/20";
  return "bg-violet-500/15 text-violet-200 border-violet-500/20";
}

function tierPill(tier: Client["tier"]) {
  if (tier === "Platinum") return "bg-white/10 text-white border-white/15";
  if (tier === "Gold") return "bg-amber-400/15 text-amber-200 border-amber-400/20";
  return "bg-slate-400/10 text-slate-200 border-slate-400/15";
}

const seedClients: Client[] = [
  {
    id: "C-1024",
    name: "Ava Chen",
    tier: "Platinum",
    nextTrip: "Kyoto & Hakone — 9 nights",
    location: "Japan",
    stage: "Booked",
    value: 18400,
    lastTouch: "Today",
  },
  {
    id: "C-2081",
    name: "Noah Patel",
    tier: "Gold",
    nextTrip: "Dolomites — 7 nights",
    location: "Italy",
    stage: "Quote",
    value: 9200,
    lastTouch: "Yesterday",
  },
  {
    id: "C-3099",
    name: "Sofia Martínez",
    tier: "Gold",
    nextTrip: "Patagonia — 12 nights",
    location: "Chile",
    stage: "Enquiry",
    value: 13200,
    lastTouch: "2d ago",
  },
  {
    id: "C-4112",
    name: "Ethan Brooks",
    tier: "Standard",
    nextTrip: "New York — 4 nights",
    location: "USA",
    stage: "Quote",
    value: 3800,
    lastTouch: "3d ago",
  },
  {
    id: "C-5120",
    name: "Mia Laurent",
    tier: "Platinum",
    nextTrip: "Bora Bora — 8 nights",
    location: "French Polynesia",
    stage: "Booked",
    value: 24600,
    lastTouch: "1w ago",
  },
];

const seedActivity: Activity[] = [
  {
    id: "A-01",
    time: "09:15",
    label: "Follow-up call — Noah Patel",
    meta: "Quote refresh + flight options",
    type: "call",
  },
  {
    id: "A-02",
    time: "10:40",
    label: "Enquiry received — Sofia Martínez",
    meta: "Two adults, flexible dates",
    type: "task",
  },
  {
    id: "A-03",
    time: "13:05",
    label: "Email sent — Ava Chen",
    meta: "Hotel confirmations + rail passes",
    type: "email",
  },
  {
    id: "A-04",
    time: "15:20",
    label: "Internal note — Mia Laurent",
    meta: "Prefers late checkouts, ocean-view",
    type: "note",
  },
];

function IconForActivity({ type }: { type: Activity["type"] }) {
  const cls = "h-4 w-4";
  if (type === "call") return <MessageSquare className={cls} />;
  if (type === "email") return <Sparkles className={cls} />;
  if (type === "task") return <Calendar className={cls} />;
  return <Ticket className={cls} />;
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <Card className="glass ringed grain rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div
            className="text-xs text-muted-foreground"
            data-testid={`text-kpi-label-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {label}
          </div>
          <div
            className="text-2xl font-semibold tracking-tight"
            data-testid={`text-kpi-value-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {value}
          </div>
        </div>
        <div
          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80"
          data-testid={`text-kpi-delta-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {delta}
        </div>
      </div>
    </Card>
  );
}

export default function CommandCenterPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"clients" | "pipeline" | "calendar">("clients");

  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return seedClients;
    return seedClients.filter((c) =>
      [c.name, c.id, c.location, c.nextTrip, c.stage, c.tier]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const totals = useMemo(() => {
    const booked = seedClients.filter((c) => c.stage === "Booked");
    const open = seedClients.filter((c) => c.stage !== "Booked");
    const bookedValue = booked.reduce((sum, c) => sum + c.value, 0);
    const openValue = open.reduce((sum, c) => sum + c.value, 0);
    return {
      bookedCount: booked.length,
      openCount: open.length,
      bookedValue,
      openValue,
      avgDeal: Math.round((bookedValue + openValue) / seedClients.length),
    };
  }, []);

  return (
    <div className="app-shell px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
              data-testid="status-command-center"
            >
              <Globe className="h-4 w-4" />
              Apple Travel · Command Center
            </div>
            <h1
              className="title-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
              data-testid="text-page-title"
            >
              Travel Sales & CRM,
              <span className="text-white/70"> designed like an instrument panel.</span>
            </h1>
            <p className="max-w-[70ch] text-sm text-muted-foreground" data-testid="text-page-subtitle">
              Manage clients, log enquiries, generate quotes, and track bookings — with a calm, premium,
              high-signal layout.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[340px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients, trips, destinations…"
                className="h-10 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/45"
                data-testid="input-search"
              />
            </div>
            <Button
              className="h-10 rounded-xl bg-white text-black hover:bg-white/90"
              data-testid="button-new-enquiry"
              onClick={() => {
                // mock action
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New enquiry
            </Button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <KpiCard label="Booked value" value={currency.format(totals.bookedValue)} delta="+12% WoW" />
          <KpiCard label="Open pipeline" value={currency.format(totals.openValue)} delta="7 active" />
          <KpiCard label="Average deal" value={currency.format(totals.avgDeal)} delta="Premium mix" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium" data-testid="text-module-title">
                  Workspace
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-module-subtitle">
                  Clients, pipeline, and calendar — all within reach.
                </div>
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="rounded-xl bg-white/5" data-testid="tabs-workspace">
                  <TabsTrigger value="clients" className="rounded-lg" data-testid="tab-clients">
                    Clients
                  </TabsTrigger>
                  <TabsTrigger value="pipeline" className="rounded-lg" data-testid="tab-pipeline">
                    Pipeline
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="rounded-lg" data-testid="tab-calendar">
                    Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Separator className="my-4 bg-white/10" />

            <Tabs value={tab}>
              <TabsContent value="clients" className="mt-0">
                <div className="grid gap-3">
                  {clients.map((c, idx) => (
                    <motion.button
                      key={c.id}
                      className="group relative w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/7 active:scale-[0.99]"
                      data-testid={`card-client-${c.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: idx * 0.03 }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                              aria-hidden
                            >
                              <UserRound className="h-4 w-4 text-white/80" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className="truncate text-sm font-semibold"
                                  data-testid={`text-client-name-${c.id}`}
                                >
                                  {c.name}
                                </div>
                                <span className="text-xs text-white/35" data-testid={`text-client-id-${c.id}`}>
                                  {c.id}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${tierPill(c.tier)}`}
                                  data-testid={`text-client-tier-${c.id}`}
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
                                <div className="inline-flex items-center gap-1 text-xs text-white/60">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span data-testid={`text-client-location-${c.id}`}>{c.location}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-1">
                            <div className="text-xs text-white/45" data-testid={`text-client-nexttrip-label-${c.id}`}>
                              Next trip
                            </div>
                            <div className="truncate text-sm" data-testid={`text-client-nexttrip-${c.id}`}>
                              {c.nextTrip}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div
                            className="text-sm font-semibold"
                            data-testid={`text-client-value-${c.id}`}
                          >
                            {currency.format(c.value)}
                          </div>
                          <div className="text-xs text-white/45" data-testid={`text-client-lasttouch-${c.id}`}>
                            Last touch: {c.lastTouch}
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-white/65">
                            <span data-testid={`text-client-open-${c.id}`}>Open</span>
                            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { stage: "Enquiry" as const, hint: "New inbound" },
                    { stage: "Quote" as const, hint: "In progress" },
                    { stage: "Booked" as const, hint: "Confirmed" },
                  ] as const).map((col) => {
                    const items = seedClients.filter((c) => c.stage === col.stage);
                    const sum = items.reduce((s, i) => s + i.value, 0);
                    return (
                      <div key={col.stage} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold" data-testid={`text-pipeline-stage-${col.stage}`}>
                              {col.stage}
                            </div>
                            <div className="text-xs text-muted-foreground" data-testid={`text-pipeline-hint-${col.stage}`}>
                              {col.hint} · {items.length} items
                            </div>
                          </div>
                          <div className="text-xs text-white/60" data-testid={`text-pipeline-sum-${col.stage}`}>
                            {currency.format(sum)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {items.map((c) => (
                            <button
                              key={c.id}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/7"
                              data-testid={`card-pipeline-${col.stage}-${c.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold" data-testid={`text-pipeline-name-${c.id}`}>
                                    {c.name}
                                  </div>
                                  <div className="mt-1 truncate text-xs text-white/55" data-testid={`text-pipeline-trip-${c.id}`}>
                                    {c.nextTrip}
                                  </div>
                                </div>
                                <div className="text-xs font-semibold" data-testid={`text-pipeline-value-${c.id}`}>
                                  {currency.format(c.value)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      data-testid={`card-calendar-${i}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold" data-testid={`text-calendar-title-${i}`}>
                          {i % 2 === 0 ? "Client call" : "Quote review"}
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-white/10 bg-white/5 text-white/80"
                          data-testid={`status-calendar-${i}`}
                        >
                          {i % 2 === 0 ? "Today" : "Tomorrow"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-white/55" data-testid={`text-calendar-meta-${i}`}>
                        {i % 2 === 0
                          ? "15 min · high intent lead"
                          : "30 min · adjust inclusions + margin"}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-white/55" data-testid={`text-calendar-time-${i}`}>
                          {i % 2 === 0 ? "14:30" : "11:00"}
                        </div>
                        <button
                          className="inline-flex items-center gap-1 text-xs text-white/70 transition hover:text-white"
                          data-testid={`button-calendar-open-${i}`}
                        >
                          Open
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="space-y-4">
            <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-panel-title">
                    Today
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-panel-subtitle">
                    High-signal focus queue.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                  data-testid="button-add-task"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              <Separator className="my-4 bg-white/10" />

              <div className="space-y-2">
                {seedActivity.map((a) => (
                  <button
                    key={a.id}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/7"
                    data-testid={`row-activity-${a.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80">
                        <IconForActivity type={a.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold" data-testid={`text-activity-label-${a.id}`}>
                            {a.label}
                          </div>
                          <div className="text-xs text-white/45" data-testid={`text-activity-time-${a.id}`}>
                            {a.time}
                          </div>
                        </div>
                        <div className="mt-1 truncate text-xs text-white/55" data-testid={`text-activity-meta-${a.id}`}>
                          {a.meta}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-quick-actions-title">
                    Quick actions
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-quick-actions-subtitle">
                    Fast, consistent workflows.
                  </div>
                </div>
              </div>

              <Separator className="my-4 bg-white/10" />

              <div className="grid gap-2">
                <button
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/7"
                  data-testid="button-action-new-quote"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Sparkles className="h-4 w-4 text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" data-testid="text-action-new-quote">
                        New quote
                      </div>
                      <div className="text-xs text-white/55" data-testid="text-action-new-quote-sub">
                        Build inclusions, margin, and itinerary.
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/60" />
                </button>

                <button
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/7"
                  data-testid="button-action-new-booking"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Ticket className="h-4 w-4 text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" data-testid="text-action-new-booking">
                        Convert to booking
                      </div>
                      <div className="text-xs text-white/55" data-testid="text-action-new-booking-sub">
                        Confirm suppliers and schedule payments.
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/60" />
                </button>

                <button
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/7"
                  data-testid="button-action-new-client"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <UserRound className="h-4 w-4 text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" data-testid="text-action-new-client">
                        Add client
                      </div>
                      <div className="text-xs text-white/55" data-testid="text-action-new-client-sub">
                        Capture preferences and passport details.
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/60" />
                </button>
              </div>
            </Card>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-4 ringed">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-white/70" data-testid="text-assist-label">
                    Assist
                  </div>
                  <div className="title-serif text-lg font-semibold" data-testid="text-assist-title">
                    Next-best actions
                  </div>
                  <div className="text-xs text-white/55" data-testid="text-assist-sub">
                    High intent leads and at-risk quotes detected.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Sparkles className="h-5 w-5 text-white/80" />
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <div
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
                  data-testid="text-assist-item-1"
                >
                  Refresh Noah’s quote with alternative departure airport (+$320 margin).
                </div>
                <div
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70"
                  data-testid="text-assist-item-2"
                >
                  Sofia’s enquiry: propose two itineraries, one adventure-forward.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
