import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import {
  BadgeCheck,
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Plus,
  PoundSterling,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchClients } from "@/lib/api";

type Stage = "Enquiry" | "Quote" | "Booked";

type ClientTier = "Platinum" | "Gold" | "Standard";

type ClientDisplay = {
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
      return "border-violet-500/30 bg-violet-500/15 text-violet-700";
    case "Gold":
      return "border-amber-500/30 bg-amber-500/15 text-amber-700";
    default:
      return "border-black/10 bg-black/5 text-black/70";
  }
}

function stagePill(stage: Stage) {
  switch (stage) {
    case "Booked":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-700";
    case "Quote":
      return "border-sky-500/30 bg-sky-500/15 text-sky-700";
    default:
      return "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-700";
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

function tierGradient(tier: ClientTier) {
  switch (tier) {
    case "Platinum":
      return "from-violet-500/10 via-transparent to-transparent";
    case "Gold":
      return "from-amber-500/10 via-transparent to-transparent";
    default:
      return "from-black/[0.02] via-transparent to-transparent";
  }
}

function parseLastTouch(v: string): number {
  if (!v) return 999;
  const lower = v.toLowerCase().trim();
  if (lower === "today") return 0;
  if (lower === "yesterday") return 1;
  const daysMatch = lower.match(/(\d+)\s*d/i);
  if (daysMatch) return parseInt(daysMatch[1]!, 10) + 1;
  const weeksMatch = lower.match(/(\d+)\s*week/i);
  if (weeksMatch) return parseInt(weeksMatch[1]!, 10) * 7;
  const monthsMatch = lower.match(/(\d+)\s*month/i);
  if (monthsMatch) return parseInt(monthsMatch[1]!, 10) * 30;
  return 99;
}

const segmentStyles = {
  violet: {
    card: "border-violet-500/20 bg-violet-50/50",
    icon: "bg-violet-500/10",
    iconColor: "text-violet-600",
  },
  amber: {
    card: "border-amber-500/20 bg-amber-50/50",
    icon: "bg-amber-500/10",
    iconColor: "text-amber-600",
  },
  fuchsia: {
    card: "border-fuchsia-500/20 bg-fuchsia-50/50",
    icon: "bg-fuchsia-500/10",
    iconColor: "text-fuchsia-600",
  },
  sky: {
    card: "border-sky-500/20 bg-sky-50/50",
    icon: "bg-sky-500/10",
    iconColor: "text-sky-600",
  },
} as const;

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<Role>("Agent");
  const [active] = useState<string>("clients");

  const { data: apiClients, isLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: fetchClients,
  });

  const clients = useMemo((): ClientDisplay[] => {
    if (!apiClients) return [];
    return apiClients.map((c) => ({
      id: c.id,
      name: c.name || "Unknown",
      tier: (c.tier as ClientTier) || "Standard",
      stage: (c.stage as Stage) || "Enquiry",
      location: c.location || "",
      nextTrip: c.nextTrip || "",
      value: Number(c.value) || 0,
      lastTouch: c.lastTouch || "",
      email: c.email || "",
      phone: c.phone || "",
      tags: c.tags || [],
    }));
  }, [apiClients]);

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | Stage>("all");
  const [tier, setTier] = useState<"all" | ClientTier>("all");
  const [sort, setSort] = useState<"value" | "lastTouch" | "name">("value");
  const [tab, setTab] = useState<"directory" | "segments" | "recent">("directory");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = clients.filter((c) => {
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        c.location.toLowerCase().includes(query) ||
        c.nextTrip.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        c.tags.some((t) => t.toLowerCase().includes(query));

      const matchesStage = stage === "all" ? true : c.stage === stage;
      const matchesTier = tier === "all" ? true : c.tier === tier;
      return matchesQuery && matchesStage && matchesTier;
    });

    const s = [...base].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "lastTouch") {
        return parseLastTouch(a.lastTouch) - parseLastTouch(b.lastTouch);
      }
      return b.value - a.value;
    });

    return s;
  }, [q, stage, tier, sort, clients]);

  const totals = useMemo(() => {
    const booked = clients.filter((c) => c.stage === "Booked");
    const quotes = clients.filter((c) => c.stage === "Quote");
    const enquiries = clients.filter((c) => c.stage === "Enquiry");
    const bookedValue = booked.reduce((s, i) => s + i.value, 0);
    const pipeValue = quotes.reduce((s, i) => s + i.value, 0) + enquiries.reduce((s, i) => s + i.value, 0);
    const platinum = clients.filter((c) => c.tier === "Platinum").length;
    const gold = clients.filter((c) => c.tier === "Gold").length;
    return {
      total: clients.length,
      bookedCount: booked.length,
      quotesCount: quotes.length,
      enquiriesCount: enquiries.length,
      bookedValue,
      pipeValue,
      avg: Math.round((bookedValue + pipeValue) / Math.max(clients.length, 1)),
      platinum,
      gold,
    };
  }, [clients]);

  const recentClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => parseLastTouch(a.lastTouch) - parseLastTouch(b.lastTouch))
      .slice(0, 5);
  }, [clients]);

  return (
    <CommandCenterShell
      role={role}
      onRoleChange={setRole}
      active={active}
      title="Clients"
      subtitle="Your client directory"
      query={q}
      onQuery={setQ}
      theme="light"
      onToggleTheme={() => {}}
    >
      <div className="relative min-h-[calc(100vh-56px)] w-full px-4 pb-6 md:px-6 md:pb-8">
        <div className="relative mt-6 space-y-4">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black" data-testid="heading-clients">
                Clients
              </h1>
              <p className="mt-1 text-sm text-black/60" data-testid="subheading-clients">
                Manage your client relationships and track their journey
              </p>
            </div>
            <Button
              className="h-11 gap-2 rounded-2xl bg-black px-5 text-white hover:bg-black/90"
              data-testid="button-add-client"
              onClick={() => {}}
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-5" data-testid="grid-client-stats">
            <Card className="rounded-2xl border-black/10 bg-white/80 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5">
                  <Users className="h-5 w-5 text-black/70" />
                </div>
                <div>
                  <div className="text-2xl font-semibold" data-testid="stat-total-clients">{totals.total}</div>
                  <div className="text-xs text-black/55">Total Clients</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-emerald-500/20 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <BadgeCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-emerald-700" data-testid="stat-booked">{totals.bookedCount}</div>
                  <div className="text-xs text-emerald-600/70">Booked</div>
                </div>
              </div>
              <div className="mt-2 text-xs font-medium text-emerald-600" data-testid="stat-booked-value">
                {currency.format(totals.bookedValue)}
              </div>
            </Card>

            <Card className="rounded-2xl border-sky-500/20 bg-sky-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                  <TrendingUp className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-sky-700" data-testid="stat-quotes">{totals.quotesCount}</div>
                  <div className="text-xs text-sky-600/70">Quotes Sent</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-fuchsia-500/20 bg-fuchsia-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10">
                  <Sparkles className="h-5 w-5 text-fuchsia-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-fuchsia-700" data-testid="stat-enquiries">{totals.enquiriesCount}</div>
                  <div className="text-xs text-fuchsia-600/70">New Enquiries</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-violet-500/20 bg-violet-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                  <Star className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-violet-700" data-testid="stat-vip">{totals.platinum}</div>
                  <div className="text-xs text-violet-600/70">VIP Platinum</div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-3xl border-black/10 bg-white/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, email, phone, destination..."
                  className="h-10 rounded-2xl border-black/10 bg-white pl-10 text-black placeholder:text-black/40"
                  data-testid="input-client-search"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2" data-testid="group-client-filters">
                <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-white p-1">
                  {(["all", "Enquiry", "Quote", "Booked"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition " +
                        (stage === s ? "bg-black text-white" : "text-black/70 hover:bg-black/5")
                      }
                      data-testid={`filter-stage-${s.toLowerCase()}`}
                      onClick={() => setStage(s as any)}
                    >
                      {s === "all" ? "All Stages" : s}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-white p-1">
                  {(["all", "Platinum", "Gold", "Standard"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={
                        "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition " +
                        (tier === t ? "bg-black text-white" : "text-black/70 hover:bg-black/5")
                      }
                      data-testid={`filter-tier-${t.toLowerCase()}`}
                      onClick={() => setTier(t as any)}
                    >
                      {t === "all" ? "All Tiers" : t}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-white p-1">
                  {([
                    { key: "value", label: "Value" },
                    { key: "lastTouch", label: "Recent" },
                    { key: "name", label: "A-Z" },
                  ] as const).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      className={
                        "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition " +
                        (sort === o.key ? "bg-black text-white" : "text-black/70 hover:bg-black/5")
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
          </Card>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
            <TabsList className="rounded-2xl border border-black/10 bg-white/80 p-1" data-testid="tabs-clients">
              <TabsTrigger value="directory" className="rounded-xl px-4" data-testid="tab-directory">
                <Users className="mr-2 h-4 w-4" />
                All Clients
              </TabsTrigger>
              <TabsTrigger value="recent" className="rounded-xl px-4" data-testid="tab-recent">
                <Clock className="mr-2 h-4 w-4" />
                Recent Activity
              </TabsTrigger>
              <TabsTrigger value="segments" className="rounded-xl px-4" data-testid="tab-segments">
                <Filter className="mr-2 h-4 w-4" />
                Segments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="directory" className="space-y-3">
              {isLoading ? (
                <Card className="rounded-3xl border-black/10 bg-white/70 p-8 text-center">
                  <div className="animate-pulse text-black/50">Loading clients...</div>
                </Card>
              ) : filtered.length === 0 ? (
                <Card className="rounded-3xl border-black/10 bg-white/70 p-8 text-center" data-testid="empty-client-results">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5">
                    <Search className="h-6 w-6 text-black/40" />
                  </div>
                  <div className="mt-4 text-sm font-semibold">No clients found</div>
                  <div className="mt-1 text-xs text-black/55">Try adjusting your search or filters</div>
                </Card>
              ) : (
                <div className="space-y-3" data-testid="list-client-results">
                  {filtered.map((c, idx) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                    >
                      <Card
                        className={`group relative overflow-hidden rounded-3xl border-black/10 bg-white p-5 transition hover:shadow-lg cursor-pointer`}
                        data-testid={`card-client-${c.id}`}
                        onClick={() => navigate(`/clients/${c.id}`)}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-r ${tierGradient(c.tier)} pointer-events-none`} />
                        
                        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <div
                              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                                c.tier === "Platinum" ? "border-violet-300 bg-violet-100" :
                                c.tier === "Gold" ? "border-amber-300 bg-amber-100" :
                                "border-black/10 bg-black/5"
                              }`}
                              data-testid={`avatar-client-${c.id}`}
                            >
                              <span className={`text-lg font-bold ${
                                c.tier === "Platinum" ? "text-violet-700" :
                                c.tier === "Gold" ? "text-amber-700" :
                                "text-black/70"
                              }`}>
                                {shortInitials(c.name)}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-black" data-testid={`text-client-name-${c.id}`}>
                                  {c.name}
                                </h3>
                                <Badge variant="outline" className={`rounded-full text-[10px] ${tierPill(c.tier)}`} data-testid={`badge-tier-${c.id}`}>
                                  {c.tier}
                                </Badge>
                                <Badge variant="outline" className={`rounded-full text-[10px] ${stagePill(c.stage)}`} data-testid={`badge-stage-${c.id}`}>
                                  {c.stage}
                                </Badge>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/60">
                                <span className="inline-flex items-center gap-1" data-testid={`text-location-${c.id}`}>
                                  <MapPin className="h-3.5 w-3.5" />
                                  {c.location}
                                </span>
                                <a
                                  href={`mailto:${c.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 hover:text-black transition"
                                  data-testid={`link-email-${c.id}`}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  {c.email}
                                </a>
                                <a
                                  href={`tel:${c.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 hover:text-black transition"
                                  data-testid={`link-phone-${c.id}`}
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  {c.phone}
                                </a>
                              </div>

                              {c.nextTrip && (
                                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-black/5 px-3 py-1.5">
                                  <Plane className="h-3.5 w-3.5 text-black/50" />
                                  <span className="text-xs font-medium text-black/70" data-testid={`text-trip-${c.id}`}>
                                    {c.nextTrip}
                                  </span>
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {c.tags.map((t, i) => (
                                  <span
                                    key={t + i}
                                    className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-0.5 text-[10px] font-semibold text-black/60"
                                    data-testid={`tag-${c.id}-${i}`}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3 md:min-w-[140px]">
                            <div className="text-right">
                              <div className="text-lg font-semibold text-black" data-testid={`text-value-${c.id}`}>
                                {currency.format(c.value)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-black/50" data-testid={`text-lasttouch-${c.id}`}>
                                <Clock className="h-3 w-3" />
                                {c.lastTouch}
                              </div>
                            </div>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={`tel:${c.phone}`}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:bg-black hover:text-white"
                                title="Call"
                                data-testid={`action-call-${c.id}`}
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                              <a
                                href={`mailto:${c.email}`}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:bg-black hover:text-white"
                                title="Email"
                                data-testid={`action-email-${c.id}`}
                              >
                                <Mail className="h-4 w-4" />
                              </a>
                              <a
                                href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-500 hover:text-white"
                                title="WhatsApp"
                                data-testid={`action-whatsapp-${c.id}`}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </div>

                            <button
                              type="button"
                              className="flex items-center gap-1 text-xs font-semibold text-black/70 transition group-hover:text-black"
                              onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}
                              data-testid={`link-view-${c.id}`}
                            >
                              View Details
                              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="recent" className="space-y-3">
              <Card className="rounded-3xl border-black/10 bg-white/70 p-5">
                <h3 className="text-sm font-semibold text-black mb-4">Recent Client Activity</h3>
                <div className="space-y-3">
                  {recentClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/clients/${c.id}`)}
                      className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white p-4 text-left transition hover:bg-black/[0.02]"
                      data-testid={`recent-client-${c.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5">
                          <span className="text-xs font-semibold text-black/70">{shortInitials(c.name)}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-black/50">{c.lastTouch} · {c.stage}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`rounded-full text-[10px] ${stagePill(c.stage)}`}>
                          {c.stage}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-black/40" />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="segments" className="grid gap-3 md:grid-cols-2">
              {([
                {
                  id: "vip",
                  title: "VIP Platinum",
                  desc: "High-value clients expecting premium service",
                  icon: Star,
                  color: "violet" as const,
                  count: totals.platinum,
                },
                {
                  id: "gold",
                  title: "Gold Members",
                  desc: "Loyal repeat customers with consistent bookings",
                  icon: BadgeCheck,
                  color: "amber" as const,
                  count: totals.gold,
                },
                {
                  id: "hot-leads",
                  title: "Hot Leads",
                  desc: "Enquiries needing follow-up within 24 hours",
                  icon: Sparkles,
                  color: "fuchsia" as const,
                  count: totals.enquiriesCount,
                },
                {
                  id: "pending-quotes",
                  title: "Pending Quotes",
                  desc: "Quotes sent awaiting client response",
                  icon: TrendingUp,
                  color: "sky" as const,
                  count: totals.quotesCount,
                },
              ]).map((seg) => {
                const styles = segmentStyles[seg.color];
                return (
                  <Card
                    key={seg.id}
                    className={`group cursor-pointer rounded-3xl ${styles.card} p-5 transition hover:shadow-md`}
                    data-testid={`segment-${seg.id}`}
                    onClick={() => {
                      if (seg.id === "vip") setTier("Platinum");
                      else if (seg.id === "gold") setTier("Gold");
                      else if (seg.id === "hot-leads") { setStage("Enquiry"); setTier("all"); }
                      else if (seg.id === "pending-quotes") { setStage("Quote"); setTier("all"); }
                      setTab("directory");
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}>
                          <seg.icon className={`h-6 w-6 ${styles.iconColor}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-black">{seg.title}</h4>
                          <p className="mt-1 text-xs text-black/55">{seg.desc}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-black">{seg.count}</div>
                        <div className="text-xs text-black/50">clients</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-black/60 group-hover:text-black">
                      View segment
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </CommandCenterShell>
  );
}
