import { useState, useEffect } from "react";
import {
  BadgeCheck,
  Clock,
  Plane,
  ImagePlus,
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
} from "lucide-react";
import type { NeonClient } from "@/types/neon-client";
import type { EnquiryTable } from "@/types/quote";
import {
  currency,
  type QuoteWithJoins,
  type BookingWithJoins,
  type TicketItem,
  formatUKDate,
  formatTicketDate,
  ticketStatusPill,
  ticketTypePill,
} from "./client-types";
import type { Client } from "./client-types";
import { useVipOverview } from "@/hooks/queries/use-referral-queries";
import type { TaskNew } from "@shared/schema";

export function ReferralStatsSection({ clientId }: { clientId: string }) {
  const { data, isLoading } = useVipOverview(clientId);
  const stats = data?.stats;

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
  const pending = stats?.pendingPayout ?? 0;
  const wallet = stats?.availableBalance ?? 0;
  const overall = stats?.overallPayout ?? 0;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3" data-testid="referral-stats-section">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-purple-600" />
        <div className="text-sm font-semibold text-black">Referral Summary</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-2.5" data-testid="stat-total-referred">
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-purple-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Referred</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{total}</div>
          <div className="text-[9px] text-black/40">Total clients</div>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5" data-testid="stat-pending-commission">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-amber-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Pending</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{currency.format(pending)}</div>
          <div className="text-[9px] text-black/40">Awaiting approval</div>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-2.5" data-testid="stat-wallet-balance">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3 w-3 text-blue-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Wallet</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{currency.format(wallet)}</div>
          <div className="text-[9px] text-black/40">Ready to withdraw</div>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5" data-testid="stat-overall-commission">
          <div className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3 w-3 text-emerald-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Overall</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{currency.format(overall)}</div>
          <div className="text-[9px] text-black/40">All-time commission</div>
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
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="card-portal-pin">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-black/60" />
          <h3 className="text-sm font-semibold text-black">Portal Access</h3>
        </div>
        {hasPin && !editing && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" data-testid="badge-pin-active">
            <Check className="h-3 w-3" /> PIN Active
          </span>
        )}
      </div>

      {!hasPin && !editing && (
        <div>
          <p className="text-sm text-black/50 mb-2">No portal PIN set. Set a 4-digit PIN to give this client access to the portal.</p>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
            data-testid="button-set-pin"
          >
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
              className="w-32 px-3 py-1.5 text-sm border border-black/10 rounded-lg bg-white/80 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="input-set-pin"
            />
            <button
              onClick={handleSetPin}
              disabled={pin.length !== 4 || saving}
              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              data-testid="button-confirm-pin"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { setEditing(false); setPin(""); }}
              className="p-1.5 rounded-lg bg-black/10 text-black/60 hover:bg-black/20 transition-colors"
              data-testid="button-cancel-pin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-black/40">The client will use this PIN with their email to log in to the portal.</p>
        </div>
      )}

      {hasPin && !editing && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-black/60">PIN: <span className="tracking-widest">****</span></p>
            <p className="text-xs text-black/40 mt-1">Client can log in with their email + this PIN</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-black/10 text-black/70 hover:bg-black/20 transition-colors"
              data-testid="button-change-pin"
            >
              Change
            </button>
            <button
              onClick={handleRemovePin}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
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
  tasks: TaskNew[];
  clientId: string;
  navigate: (to: string) => void;
}

export function ClientOverviewTab({
  clientData,
  client,
  enquiries,
  quotes,
  bookings,
  tickets,
  tasks,
  clientId,
  navigate,
}: ClientOverviewTabProps) {
  return (
    <div className="grid gap-3" data-testid="panel-overview">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="overview-stats">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-enquiries">
          <div className="text-2xl font-bold text-black/85">{enquiries.length}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-black/50">Enquiries</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-quotes">
          <div className="text-2xl font-bold text-black/85">{quotes.length}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-black/50">Quotes</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-bookings">
          <div className="text-2xl font-bold text-emerald-600">{bookings.length}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-black/50">Bookings</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-total-value">
          <div className="text-2xl font-bold text-black/85">
            {currency.format(
              bookings.reduce((sum: number, b: BookingWithJoins) => sum + parseFloat(b.package_commission || "0"), 0)
            )}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-black/50">Total Profit</div>
        </div>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-activity">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-black/60" />
          <div className="text-sm font-semibold text-black">Recent Activity</div>
        </div>
        {(() => {
          const activities: Array<{
            id: string;
            type: "Enquiry" | "Quote" | "Booking";
            title: string;
            date: string;
            status?: string;
            link: string;
            imageUrl?: string | null;
            meta?: string;
          }> = [];
          enquiries.slice(0, 3).forEach((e: EnquiryTable) => {
            activities.push({
              id: `e-${e.id}`,
              type: "Enquiry",
              title: e.title || "Enquiry",
              date: e.date_created || "",
              status: e.status ?? undefined,
              link: `/clients/${clientId}/enquiries/${e.id}`,
              imageUrl: null,
              meta: e.holiday_type_name || "Enquiry",
            });
          });
          quotes.slice(0, 3).forEach((q: QuoteWithJoins) => {
            activities.push({
              id: `q-${q.id}`,
              type: "Quote",
              title: q.title || q.holiday_type_name || "Trip",
              date: q.date_created || "",
              status: (q.quote_status || "NEW_LEAD").replace(/_/g, " "),
              link: `/clients/${clientId}/quotes/${q.id}`,
              imageUrl: q.images?.find((img) => img.isPrimary)?.image_url || q.images?.[0]?.image_url || null,
              meta: q.holiday_type_name || q.quote_type || "Quote",
            });
          });
          bookings.slice(0, 3).forEach((b: BookingWithJoins) => {
            activities.push({
              id: `b-${b.id}`,
              type: "Booking",
              title: b.title || b.holiday_type_name || "Booking",
              date: b.date_created || "",
              status: b.booking_status || "BOOKED",
              link: `/clients/${clientId}/bookings/${b.id}`,
              imageUrl: b.images?.find((img) => img.isPrimary)?.image_url || b.images?.[0]?.image_url || null,
              meta: b.holiday_type_name || "Booking",
            });
          });
          activities.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          const recent = activities.slice(0, 6);
          if (recent.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-4 text-center text-xs text-black/45" data-testid="empty-activity">
                No activity yet
              </div>
            );
          }

          const typeStyle = (type: "Enquiry" | "Quote" | "Booking") => {
            if (type === "Booking") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
            if (type === "Quote") return "border-sky-500/25 bg-sky-500/10 text-sky-700";
            return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700";
          };

          return (
            <div className="grid gap-2">
              {recent.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99]"
                  data-testid={`activity-${a.id}`}
                  onClick={() => navigate(a.link)}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.05] via-white/30 to-transparent" aria-hidden>
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-black/20">
                          <ImagePlus className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-black/85">{a.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                            {a.meta && <span>{a.meta}</span>}
                            {a.date && (
                              <>
                                <span className="text-black/25">•</span>
                                <span>{formatUKDate(a.date)}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${typeStyle(a.type)}`}>
                              {a.type}
                            </span>
                            {a.status && (
                              <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-black/55">
                                {a.status}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/60">
                          View
                          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-client-overview">
        <div className="mb-3 flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-black/60" />
          <div className="text-sm font-semibold text-black">Overview</div>
        </div>

        <div className="flex flex-col gap-4">
          <div data-testid="overview-client-tasks">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black/45">All Tasks ({tasks.length})</div>
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-3 text-center text-xs text-black/45">
                No tasks for this client
              </div>
            ) : (
              <div className="grid gap-2">
                {[...tasks]
                  .sort((a, b) => {
                    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return da - db;
                  })
                  .map((task) => (
                    <div key={task.id} className="rounded-xl border border-black/10 bg-white/65 p-2.5" data-testid={`overview-task-${task.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-semibold text-black/80">{task.title || "Untitled task"}</div>
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${task.completed ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                          {task.completed ? "Done" : "Open"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-black/45">Due: {task.dueDate ? formatUKDate(new Date(task.dueDate).toISOString()) : "No due date"}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div data-testid="overview-client-tickets">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black/45">All Tickets ({tickets.length})</div>
            {tickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-3 text-center text-xs text-black/45">
                No tickets for this client
              </div>
            ) : (
              <div className="grid gap-2">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border border-black/10 bg-white/65 p-2.5" data-testid={`overview-ticket-${ticket.id}`}>
                    <div className="truncate text-xs font-semibold text-black/80">{ticket.subject}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${ticketStatusPill(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${ticketTypePill(ticket.type)}`}>
                        {ticket.type}
                      </span>
                      <span className="text-[10px] text-black/45">{formatTicketDate(ticket.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-preferences">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-black/60" />
            <div className="text-sm font-semibold text-black">Commission Summary</div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
              <span className="text-xs text-black/60">In Play value</span>
              <span className="text-xs font-semibold text-black/85" data-testid="overview-inplay-value">
                {currency.format(quotes.filter((q: QuoteWithJoins) => q.quote_status && !["WON", "LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status)).reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0))}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
              <span className="text-xs text-black/60">Won value</span>
              <span className="text-xs font-semibold text-black/85" data-testid="overview-won-value">
                {currency.format(quotes.filter((q: QuoteWithJoins) => q.quote_status === "WON").reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0))}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <span className="text-xs font-medium text-emerald-700">Booked commission</span>
              <span className="text-xs font-bold text-emerald-700" data-testid="overview-booked-value">
                {currency.format(bookings.reduce((sum: number, b: BookingWithJoins) => sum + parseFloat(b.package_commission || "0"), 0))}
              </span>
            </div>
          </div>
        </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-tags-section">
          <div className="mb-3 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-black/60" />
            <div className="text-sm font-semibold text-black">Tags &amp; Status</div>
          </div>
          <div className="grid gap-3">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Client Type</div>
              <span className="inline-flex items-center rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6]" data-testid="overview-client-type">
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
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Open Tickets</div>
              <span className="text-sm font-semibold text-black/85" data-testid="overview-open-tickets">
                {tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length}
              </span>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
