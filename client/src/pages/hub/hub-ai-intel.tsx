import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  Calendar,
  MapPin,
  MessageSquare,
  Plane,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { HubSectionHeader, HubBadge, HubAvatar } from "@/features/hub/components/hub-components";
import { destinations } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DestinationIntel } from "@/data/hub-mock";

function DataCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PricingChart({ data }: { data: { month: string; price: number }[] }) {
  const max = Math.max(...data.map((d) => d.price));
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.price / max) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full rounded-t bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 min-h-[4px]"
          />
          <span className="text-[10px] text-slate-400">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function DestinationDetail({ dest }: { dest: DestinationIntel }) {
  return (
    <div data-testid="section-destination-detail">
      <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-blue-500/20 dark:from-blue-500/5 dark:to-indigo-500/5">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white" data-testid="text-destination-name">{dest.name}</h2>
          <HubBadge variant="blue">{dest.country}</HubBadge>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600/70 dark:text-blue-400/70">
          <Sparkles className="h-3 w-3" /> AI Generated Summary
        </div>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{dest.summary}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DataCard icon={Building2} title="Most Quoted Hotels">
          <ul className="space-y-1.5">
            {dest.mostQuotedHotels.map((h, i) => (
              <li key={h} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                  {i + 1}
                </span>
                {h}
              </li>
            ))}
          </ul>
        </DataCard>

        <DataCard icon={BarChart3} title="Average Selling Price">
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{dest.avgSellingPrice}</p>
          <p className="mt-1 text-xs text-slate-500">Per person, per booking</p>
        </DataCard>

        <DataCard icon={Utensils} title="Most Common Board Basis">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{dest.commonBoardBasis}</p>
        </DataCard>

        <DataCard icon={Plane} title="Top Departure Airports">
          <div className="flex flex-wrap gap-1.5">
            {dest.topDepartureAirports.map((a) => (
              <HubBadge key={a}>{a}</HubBadge>
            ))}
          </div>
        </DataCard>

        <DataCard icon={Calendar} title="Peak Booking Months">
          <div className="flex flex-wrap gap-1.5">
            {dest.peakMonths.map((m) => (
              <HubBadge key={m} variant="amber">{m}</HubBadge>
            ))}
          </div>
        </DataCard>

        <DataCard icon={ShieldAlert} title="Common Objections">
          <ul className="space-y-1.5">
            {dest.commonObjections.map((o) => (
              <li key={o} className="text-sm text-slate-600 dark:text-slate-400">"{o}"</li>
            ))}
          </ul>
        </DataCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" /> AI Insights — Trending Hotels
          </div>
          <div className="mt-4 space-y-3">
            {dest.trendingHotels.map((h) => (
              <div key={h.name} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">{h.name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-purple-500"
                      style={{ width: `${(h.bookings / Math.max(...dest.trendingHotels.map((t) => t.bookings))) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{h.bookings}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Pricing Trends
          </div>
          <div className="mt-4">
            <PricingChart data={dest.pricingTrends} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Agent Notes
          </div>
          <Button size="sm" variant="outline" className="text-xs" data-testid="button-add-note">
            <Plus className="mr-1 h-3 w-3" /> Add Note
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {dest.agentNotes.map((n, i) => (
            <div key={i} className="flex gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <HubAvatar initials={n.author.split(" ").map((w) => w[0]).join("")} size="sm" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{n.author}</span>
                  <span className="text-xs text-slate-400">{n.date}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HubAiIntel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return destinations;
    return destinations.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.country.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const selected = selectedId ? destinations.find((d) => d.id === selectedId) : null;

  return (
    <div data-testid="page-hub-ai-intel">
      <HubSectionHeader
        title="AI Destination Intelligence"
        subtitle="Data-driven insights to help you sell smarter."
      />

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search destination..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
          className="h-12 rounded-xl border-slate-200 bg-white pl-12 text-base shadow-sm dark:border-slate-700 dark:bg-slate-900"
          data-testid="input-destination-search"
        />
      </div>

      {selected ? (
        <>
          <button
            onClick={() => setSelectedId(null)}
            className="mb-4 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            data-testid="button-back-destinations"
          >
            ← Back to all destinations
          </button>
          <DestinationDetail dest={selected} />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((dest, i) => (
            <motion.div
              key={dest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedId(dest.id)}
              className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30"
              data-testid={`card-destination-${dest.id}`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                  {dest.name}
                </h3>
                <HubBadge>{dest.country}</HubBadge>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{dest.summary}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span>Avg. {dest.avgSellingPrice}</span>
                <span>{dest.commonBoardBasis}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
