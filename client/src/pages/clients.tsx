import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Filter,
  Grid3X3,
  List,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function shortInitials(name: string) {
  const parts = name.split(" ").map((p) => p.trim()).filter(Boolean);
  const a = parts[0]?.[0] ?? "C";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
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

const tierColors = {
  Platinum: { bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  Gold: { bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  Standard: { bg: "bg-slate-400", light: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

const stageColors = {
  Enquiry: { bg: "bg-fuchsia-500", dot: "bg-fuchsia-400" },
  Quote: { bg: "bg-sky-500", dot: "bg-sky-400" },
  Booked: { bg: "bg-emerald-500", dot: "bg-emerald-400" },
};

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"all" | Stage>("all");
  const [tier, setTier] = useState<"all" | ClientTier>("all");
  const [sort, setSort] = useState<"value" | "lastTouch" | "name">("value");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

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

  const filtered = useMemo(() => {
    const base = clients.filter((c) => {
      const matchesQuery = q === "" || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase());
      const matchesStage = stage === "all" || c.stage === stage;
      const matchesTier = tier === "all" || c.tier === tier;
      return matchesQuery && matchesStage && matchesTier;
    });
    return [...base].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "lastTouch") return parseLastTouch(a.lastTouch) - parseLastTouch(b.lastTouch);
      return b.value - a.value;
    });
  }, [q, stage, tier, sort, clients]);

  const counts = useMemo(() => ({
    all: clients.length,
    Enquiry: clients.filter((c) => c.stage === "Enquiry").length,
    Quote: clients.filter((c) => c.stage === "Quote").length,
    Booked: clients.filter((c) => c.stage === "Booked").length,
    Platinum: clients.filter((c) => c.tier === "Platinum").length,
    Gold: clients.filter((c) => c.tier === "Gold").length,
    Standard: clients.filter((c) => c.tier === "Standard").length,
  }), [clients]);

  const activeFilters = (stage !== "all" ? 1 : 0) + (tier !== "all" ? 1 : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
              data-testid="link-back-home"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
            <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 font-medium">
              {clients.length}
            </Badge>
          </div>
          <Button
            size="sm"
            className="gap-2 rounded-full bg-slate-900 text-white hover:bg-slate-800"
            data-testid="button-add-client"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Pipeline Stage Tabs */}
        <div className="mb-6 flex flex-wrap items-center gap-2" data-testid="pipeline-tabs">
          {(["all", "Enquiry", "Quote", "Booked"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                stage === s
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
              data-testid={`tab-stage-${s}`}
            >
              {s !== "all" && (
                <span className={`h-2 w-2 rounded-full ${stageColors[s].dot}`} />
              )}
              <span>{s === "all" ? "All Clients" : s}</span>
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                stage === s ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {s === "all" ? counts.all : counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Search and Filters Row */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-full border-slate-200 bg-white pl-10 pr-4 text-sm focus-visible:ring-slate-400"
              data-testid="input-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 rounded-full border-slate-200 ${showFilters ? "bg-slate-100" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
                  {activeFilters}
                </span>
              )}
            </Button>
            <div className="flex items-center rounded-full border border-slate-200 bg-white p-1">
              <button
                onClick={() => setView("grid")}
                className={`rounded-full p-1.5 transition ${view === "grid" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
                data-testid="button-view-grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`rounded-full p-1.5 transition ${view === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid="select-sort"
            >
              <option value="value">Highest Value</option>
              <option value="lastTouch">Recently Active</option>
              <option value="name">A-Z</option>
            </select>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-500">Tier:</span>
                    {(["all", "Platinum", "Gold", "Standard"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTier(t)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          tier === t
                            ? t === "all"
                              ? "bg-slate-900 text-white"
                              : `${tierColors[t].light} ${tierColors[t].text} ${tierColors[t].border} border`
                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        }`}
                        data-testid={`filter-tier-${t}`}
                      >
                        {t !== "all" && <Star className="h-3 w-3" />}
                        {t === "all" ? "All Tiers" : t}
                        <span className="text-[10px] opacity-60">({t === "all" ? counts.all : counts[t]})</span>
                      </button>
                    ))}
                  </div>
                  {(tier !== "all" || stage !== "all") && (
                    <button
                      onClick={() => { setTier("all"); setStage("all"); }}
                      className="ml-auto flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                      data-testid="button-clear-filters"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No clients found</h3>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your search or filters</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-clients">
            {filtered.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.12) }}
              >
                <div
                  onClick={() => navigate(`/clients/${c.id}`)}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-lg"
                  data-testid={`card-client-${c.id}`}
                >
                  {/* Tier Indicator */}
                  <div className={`absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rotate-45 ${tierColors[c.tier].bg} opacity-20`} />
                  
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tierColors[c.tier].light}`}>
                      <span className={`text-sm font-bold ${tierColors[c.tier].text}`}>
                        {shortInitials(c.name)}
                      </span>
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900" data-testid={`text-name-${c.id}`}>
                          {c.name}
                        </h3>
                        {c.tier === "Platinum" && <Star className="h-4 w-4 text-violet-500 fill-violet-500" />}
                        {c.tier === "Gold" && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${stageColors[c.stage].dot}`} />
                        {c.stage}
                        {c.location && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {c.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trip Preview */}
                  {c.nextTrip && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <Plane className="h-4 w-4 text-slate-400" />
                      <span className="truncate text-xs font-medium text-slate-600" data-testid={`text-trip-${c.id}`}>
                        {c.nextTrip}
                      </span>
                    </div>
                  )}

                  {/* Value & Actions */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900" data-testid={`text-value-${c.id}`}>
                        {currency.format(c.value)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {c.lastTouch ? `Active ${c.lastTouch}` : "No recent activity"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          title="Call"
                          data-testid={`action-call-${c.id}`}
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          title="Email"
                          data-testid={`action-email-${c.id}`}
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {c.phone && (
                        <a
                          href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-green-600"
                          title="WhatsApp"
                          data-testid={`action-whatsapp-${c.id}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="list-clients">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Client</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Stage</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Next Trip</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Value</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clients/${c.id}`)}
                    className="cursor-pointer transition hover:bg-slate-50"
                    data-testid={`row-client-${c.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tierColors[c.tier].light}`}>
                          <span className={`text-xs font-bold ${tierColors[c.tier].text}`}>
                            {shortInitials(c.name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-900">{c.name}</span>
                            {c.tier !== "Standard" && (
                              <Star className={`h-3.5 w-3.5 ${c.tier === "Platinum" ? "text-violet-500 fill-violet-500" : "text-amber-500 fill-amber-500"}`} />
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-500">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${stageColors[c.stage].dot}`} />
                        {c.stage}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="text-sm text-slate-600">{c.nextTrip || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-slate-900">{currency.format(c.value)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="p-1.5 text-slate-400 hover:text-slate-600">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="p-1.5 text-slate-400 hover:text-slate-600">
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Results Count */}
        {filtered.length > 0 && (
          <div className="mt-4 text-center text-sm text-slate-500">
            Showing {filtered.length} of {clients.length} clients
          </div>
        )}
      </div>
    </div>
  );
}
