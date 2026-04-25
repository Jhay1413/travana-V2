import { useState, useEffect } from "react";
import {
  BadgeCheck,
  Plane,
  TrendingUp,
  ChevronRight,
  Shield,
  Lock,
  Check,
  X,
  Loader2,
  Users,
  Wallet,
  CircleDollarSign,
  TrendingDown,
  FileText,
  Sparkles,
  CalendarCheck2,
  Activity,
  Tag,
  Inbox,
} from "lucide-react";
import type { NeonClient } from "@/types/neon-client";
import type { EnquiryTable } from "@/types/quote";
import { currency, type QuoteWithJoins, type BookingWithJoins, type TicketItem } from "./client-types";
import type { Client } from "./client-types";
import { useReferralStatsByClient } from "@/hooks/queries/use-referral-queries";

export function ReferralStatsSection({ clientId }: { clientId: string }) {
  const { data: stats, isLoading } = useReferralStatsByClient(clientId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 animate-pulse" data-testid="referral-stats-loading">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl border border-black/10 bg-black/[0.03]" />
        ))}
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const pending = stats?.pending ?? 0;
  const wallet = stats?.wallet ?? 0;
  const overall = stats?.overall ?? 0;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-br from-purple-500/[0.08] via-white/70 to-fuchsia-500/[0.05] p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_-12px_rgba(99,102,241,0.18)]"
      data-testid="referral-stats-section"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-purple-400/15 blur-3xl" aria-hidden />
      <div className="relative mb-3 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-xl bg-purple-500/15 text-purple-600">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-semibold text-black/85">Referral Summary</div>
          <div className="text-[10px] text-black/45">VIP rewards from this client</div>
        </div>
      </div>
      <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-2xl border border-purple-500/20 bg-white/80 p-3 backdrop-blur-sm" data-testid="stat-total-referred">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Referred</span>
          </div>
          <div className="text-2xl font-bold text-black/85 leading-none">{total}</div>
          <div className="text-[10px] text-black/40">Total clients</div>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-amber-500/20 bg-white/80 p-3 backdrop-blur-sm" data-testid="stat-pending-commission">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Pending</span>
          </div>
          <div className="text-xl font-bold text-black/85 leading-none">{currency.format(pending)}</div>
          <div className="text-[10px] text-black/40">Awaiting approval</div>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-blue-500/20 bg-white/80 p-3 backdrop-blur-sm" data-testid="stat-wallet-balance">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Wallet</span>
          </div>
          <div className="text-xl font-bold text-black/85 leading-none">{currency.format(wallet)}</div>
          <div className="text-[10px] text-black/40">Ready to withdraw</div>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-emerald-500/20 bg-white/80 p-3 backdrop-blur-sm" data-testid="stat-overall-commission">
          <div className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Overall</span>
          </div>
          <div className="text-xl font-bold text-black/85 leading-none">{currency.format(overall)}</div>
          <div className="text-[10px] text-black/40">All-time commission</div>
        </div>
      </div>
    </div>
  );
}

export function PortalPinSection({ clientId }: { clientId: string }) {
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/has-pin/${clientId}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setHasPin(d.hasPin); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  const handleSetPin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/portal/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId, pin }),
      });
      if (res.ok) {
        setHasPin(true);
        setEditing(false);
        setPin("");
      }
    } catch {}
    setSaving(false);
  };

  const handleRemovePin = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/remove-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) {
        setHasPin(false);
      }
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4 flex items-center gap-2" data-testid="card-portal-pin">
        <Loader2 className="h-4 w-4 animate-spin text-black/30" />
        <span className="text-sm text-black/50">Loading portal access...</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]" data-testid="card-portal-pin">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-xl bg-slate-900/[0.06] text-slate-700">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-black/85">Portal Access</h3>
            <p className="text-[10px] text-black/45">Secure 4-digit PIN sign-in</p>
          </div>
        </div>
        {hasPin && !editing && (
          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full font-medium" data-testid="badge-pin-active">
            <Check className="h-3 w-3" /> Active
          </span>
        )}
      </div>

      {!hasPin && !editing && (
        <div>
          <p className="text-xs text-black/55 mb-2.5">No portal PIN set. Set one to grant this client portal access.</p>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-black text-white hover:bg-black/85 transition-colors"
            data-testid="button-set-pin"
          >
            <Lock className="h-3.5 w-3.5" />
            Set Portal PIN
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-black/40" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              className="w-32 px-3 py-1.5 text-sm border border-black/10 rounded-xl bg-white tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="input-set-pin"
            />
            <button
              onClick={handleSetPin}
              disabled={pin.length !== 4 || saving}
              className="p-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              data-testid="button-confirm-pin"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { setEditing(false); setPin(""); }}
              className="p-1.5 rounded-xl bg-black/[0.06] text-black/60 hover:bg-black/[0.1] transition-colors"
              data-testid="button-cancel-pin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-black/40">The client will use this PIN with their email to log in to the portal.</p>
        </div>
      )}

      {hasPin && !editing && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-black/70">PIN: <span className="tracking-[0.3em] font-semibold">****</span></p>
            <p className="text-[11px] text-black/45 mt-0.5">Sign in with email + PIN</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-black/[0.06] text-black/70 hover:bg-black/[0.1] transition-colors"
              data-testid="button-change-pin"
            >
              Change
            </button>
            <button
              onClick={handleRemovePin}
              disabled={saving}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              data-testid="button-remove-pin"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientOverviewTabProps {
  clientData: NeonClient | undefined;
  client: Client | null;
  enquiries: EnquiryTable[];
  quotes: QuoteWithJoins[];
  bookings: BookingWithJoins[];
  tickets: TicketItem[];
  clientId: string;
  navigate: (to: string) => void;
}

const HERO_STAT_THEMES = {
  enquiries: {
    icon: Inbox,
    accent: "text-fuchsia-600",
    iconBg: "bg-fuchsia-500/12",
    border: "border-fuchsia-500/20",
    bg: "from-fuchsia-500/[0.07] via-white to-white",
  },
  quotes: {
    icon: Sparkles,
    accent: "text-sky-600",
    iconBg: "bg-sky-500/12",
    border: "border-sky-500/20",
    bg: "from-sky-500/[0.07] via-white to-white",
  },
  bookings: {
    icon: CalendarCheck2,
    accent: "text-emerald-600",
    iconBg: "bg-emerald-500/12",
    border: "border-emerald-500/20",
    bg: "from-emerald-500/[0.07] via-white to-white",
  },
  profit: {
    icon: TrendingUp,
    accent: "text-amber-600",
    iconBg: "bg-amber-500/12",
    border: "border-amber-500/20",
    bg: "from-amber-500/[0.07] via-white to-white",
  },
} as const;

function HeroStatCard({
  variant,
  label,
  value,
  testId,
  hint,
}: {
  variant: keyof typeof HERO_STAT_THEMES;
  label: string;
  value: React.ReactNode;
  testId: string;
  hint?: string;
}) {
  const theme = HERO_STAT_THEMES[variant];
  const Icon = theme.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.bg} p-3.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${theme.iconBg} ${theme.accent}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </div>
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-black/45 text-right">
          {label}
        </div>
      </div>
      <div className="mt-2.5 text-2xl font-bold leading-none text-black/90">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] text-black/45">{hint}</div>
      )}
    </div>
  );
}

export function ClientOverviewTab({
  clientData,
  client,
  enquiries,
  quotes,
  bookings,
  tickets,
  clientId,
  navigate,
}: ClientOverviewTabProps) {
  const inPlayValue = quotes
    .filter((q: QuoteWithJoins) => q.quote_status && !["WON", "LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status))
    .reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0);
  const wonValue = quotes
    .filter((q: QuoteWithJoins) => q.quote_status === "WON")
    .reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0);
  const bookedCommission = bookings.reduce(
    (sum: number, b: BookingWithJoins) => sum + parseFloat(b.package_commission || "0"),
    0,
  );
  const openTickets = tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length;

  return (
    <div className="grid gap-3" data-testid="panel-overview">
      <ReferralStatsSection clientId={clientId} />

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="overview-stats">
        <HeroStatCard
          variant="enquiries"
          label="Enquiries"
          value={enquiries.length}
          testId="stat-enquiries"
          hint="Open conversations"
        />
        <HeroStatCard
          variant="quotes"
          label="Quotes"
          value={quotes.length}
          testId="stat-quotes"
          hint="Active proposals"
        />
        <HeroStatCard
          variant="bookings"
          label="Bookings"
          value={bookings.length}
          testId="stat-bookings"
          hint="Confirmed trips"
        />
        <HeroStatCard
          variant="profit"
          label="Total Profit"
          value={currency.format(bookedCommission)}
          testId="stat-total-value"
          hint="Commission booked"
        />
      </div>

      {/* Recent activity timeline */}
      <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]" data-testid="overview-activity">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-xl bg-slate-900/[0.06] text-slate-700">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-black/85">Recent Activity</div>
            <div className="text-[10px] text-black/45">Latest touchpoints across this client</div>
          </div>
        </div>
        {(() => {
          const activities: Array<{ id: string; type: string; title: string; date: string; status?: string; link: string }> = [];
          enquiries.slice(0, 3).forEach((e: EnquiryTable) => {
            activities.push({ id: `e-${e.id}`, type: "Enquiry", title: e.title || "Enquiry", date: e.date_created || "", status: e.status ?? undefined, link: `/clients/${clientId}/enquiries/${e.id}` });
          });
          quotes.slice(0, 3).forEach((q: QuoteWithJoins) => {
            activities.push({ id: `q-${q.id}`, type: "Quote", title: q.title || q.holiday_type_name || "Trip", date: q.date_created || "", status: (q.quote_status || "NEW_LEAD").replace(/_/g, " "), link: `/clients/${clientId}/quotes/${q.id}` });
          });
          bookings.slice(0, 3).forEach((b: BookingWithJoins) => {
            activities.push({ id: `b-${b.id}`, type: "Booking", title: b.title || b.holiday_type_name || "Booking", date: b.date_created || "", status: b.booking_status || "BOOKED", link: `/clients/${clientId}/bookings/${b.id}` });
          });
          tickets.slice(0, 2).forEach((t: TicketItem) => {
            activities.push({ id: `t-${t.id}`, type: "Ticket", title: t.subject, date: t.createdAt || "", status: t.status, link: "#" });
          });
          activities.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          const recent = activities.slice(0, 5);
          if (recent.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-6 text-center" data-testid="empty-activity">
                <Activity className="mx-auto mb-1.5 h-6 w-6 text-black/15" />
                <div className="text-xs text-black/45">No activity yet</div>
              </div>
            );
          }
          const dotColor = (type: string) =>
            type === "Booking"
              ? "bg-emerald-500 ring-emerald-500/20"
              : type === "Quote"
              ? "bg-sky-500 ring-sky-500/20"
              : type === "Enquiry"
              ? "bg-fuchsia-500 ring-fuchsia-500/20"
              : "bg-slate-400 ring-slate-400/20";
          return (
            <div className="relative pl-5">
              <div className="absolute bottom-1 left-[7px] top-1 w-px bg-gradient-to-b from-black/[0.04] via-black/10 to-black/[0.04]" aria-hidden />
              <div className="grid gap-1">
                {recent.map((a, idx) => (
                  <button
                    key={a.id}
                    type="button"
                    className="group relative -ml-5 flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 pl-5 text-left transition hover:bg-black/[0.03]"
                    data-testid={`activity-${a.id}`}
                    onClick={() => navigate(a.link)}
                  >
                    <span
                      className={`absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ring-4 ${dotColor(a.type)}`}
                      aria-hidden
                    />
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${a.type === "Booking" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : a.type === "Quote" ? "border-sky-500/25 bg-sky-500/10 text-sky-700" : a.type === "Enquiry" ? "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700" : "border-black/10 bg-black/[0.03] text-black/70"}`}>
                        {a.type}
                      </span>
                      <span className="truncate text-xs font-medium text-black/80">{a.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.status && (
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-black/55">
                          {a.status}
                        </span>
                      )}
                      {a.date && (
                        <span className="text-[10px] text-black/40">
                          {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Commission + Tags */}
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]" data-testid="overview-preferences">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-black/85">Commission Summary</div>
              <div className="text-[10px] text-black/45">Pipeline value at a glance</div>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/70 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-500/70" aria-hidden />
                <span className="text-xs text-black/65">In Play value</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-black/85" data-testid="overview-inplay-value">
                {currency.format(inPlayValue)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/70 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500/70" aria-hidden />
                <span className="text-xs text-black/65">Won value</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-black/85" data-testid="overview-won-value">
                {currency.format(wonValue)}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 px-3 py-2.5">
              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-emerald-400/20 blur-2xl" aria-hidden />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-800">Booked commission</span>
                </div>
                <span className="text-sm font-bold tabular-nums text-emerald-700" data-testid="overview-booked-value">
                  {currency.format(bookedCommission)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]" data-testid="overview-tags-section">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-violet-500/10 text-violet-700">
              <BadgeCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-black/85">Tags &amp; Status</div>
              <div className="text-[10px] text-black/45">How this client is classified</div>
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Client Type</div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6]" data-testid="overview-client-type">
                <Tag className="h-3 w-3" />
                {clientData?.badge || "New Client"}
              </span>
            </div>
            {(client?.tags ?? []).length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Tags</div>
                <div className="flex flex-wrap gap-1.5" data-testid="overview-tags-list">
                  {(client?.tags ?? []).map((t, i) => (
                    <span
                      key={t + i}
                      className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                      data-testid={`overview-tag-${i}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white/60 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-black/60">
                <FileText className="h-3.5 w-3.5 text-black/40" />
                Open Tickets
              </div>
              <span className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-bold ${openTickets > 0 ? "bg-rose-500/10 text-rose-700" : "bg-black/[0.05] text-black/55"}`} data-testid="overview-open-tickets">
                {openTickets}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming trips */}
      <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]" data-testid="overview-upcoming">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-xl bg-sky-500/10 text-sky-700">
            <Plane className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-black/85">Upcoming Trips</div>
            <div className="text-[10px] text-black/45">Confirmed travel still ahead</div>
          </div>
        </div>
        {(() => {
          const upcomingItems: Array<{ id: string; title: string; type: string; travelDate: string; status: string; isBooking: boolean }> = [];
          bookings.forEach((b: BookingWithJoins) => {
            if (!b.travel_date) return;
            const td = new Date(b.travel_date);
            if (td >= new Date()) {
              upcomingItems.push({ id: b.id, title: b.title || b.holiday_type_name || "Booking", type: b.holiday_type_name || "—", travelDate: b.travel_date, status: "BOOKED", isBooking: true });
            }
          });
          upcomingItems.sort((a, b) => new Date(a.travelDate).getTime() - new Date(b.travelDate).getTime());
          const upcoming = upcomingItems.slice(0, 3);
          if (upcoming.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-6 text-center" data-testid="empty-upcoming">
                <Plane className="mx-auto mb-1.5 h-6 w-6 text-black/15" />
                <div className="text-xs text-black/45">No upcoming trips scheduled</div>
              </div>
            );
          }
          return (
            <div className="grid gap-2">
              {upcoming.map((item) => {
                const td = new Date(item.travelDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const days = Math.max(0, Math.ceil((td.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="group relative overflow-hidden flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-gradient-to-br from-white to-sky-500/[0.03] p-3 text-left transition hover:from-white hover:to-sky-500/[0.06] active:scale-[0.99]"
                    data-testid={`upcoming-trip-${item.id}`}
                    onClick={() => navigate(`/clients/${clientId}/${item.isBooking ? "bookings" : "quotes"}/${item.id}`)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-700">
                        <Plane className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-black/85" data-testid={`upcoming-title-${item.id}`}>
                          {item.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-black/55">
                          <span>{item.type}</span>
                          <span className="text-black/25">&middot;</span>
                          <span>{td.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                          {days > 0 && (
                            <>
                              <span className="text-black/25">&middot;</span>
                              <span className="font-semibold text-sky-700">in {days}d</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.isBooking ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                        {item.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
