import {
  BadgeCheck,
  Clock,
  Plane,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import type { NeonClient } from "@/types/neon-client";
import type { EnquiryTable } from "@/types/quote";
import { currency, type QuoteWithJoins, type BookingWithJoins, type TicketItem, formatUKDate } from "./client-types";
import type { Client } from "./client-types";

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
              quotes.reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0) +
              bookings.reduce((sum: number, b: BookingWithJoins) => sum + parseFloat(b.sales_price || "0"), 0)
            )}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-black/50">Total Profit</div>
        </div>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-activity">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-black/50" />
          <div className="text-xs font-semibold text-black/80">Recent Activity</div>
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
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-4 text-center text-xs text-black/45" data-testid="empty-activity">
                No activity yet
              </div>
            );
          }
          return (
            <div className="grid gap-1.5">
              {recent.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="group flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-black/[0.03]"
                  data-testid={`activity-${a.id}`}
                  onClick={() => navigate(a.link)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${a.type === "Booking" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : a.type === "Quote" ? "border-sky-500/25 bg-sky-500/10 text-sky-700" : a.type === "Enquiry" ? "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700" : "border-black/10 bg-black/[0.03] text-black/70"}`}>
                      {a.type}
                    </span>
                    <span className="truncate text-xs font-medium text-black/75">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
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
          );
        })()}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-preferences">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-black/50" />
            <div className="text-xs font-semibold text-black/80">Commission Summary</div>
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
              <span className="text-xs font-medium text-emerald-700">Booked value</span>
              <span className="text-xs font-bold text-emerald-700" data-testid="overview-booked-value">
                {currency.format(bookings.reduce((sum: number, b: BookingWithJoins) => sum + parseFloat(b.sales_price || "0"), 0))}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-tags-section">
          <div className="mb-3 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-black/50" />
            <div className="text-xs font-semibold text-black/80">Tags &amp; Status</div>
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
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-upcoming">
        <div className="mb-3 flex items-center gap-2">
          <Plane className="h-4 w-4 text-black/50" />
          <div className="text-xs font-semibold text-black/80">Upcoming Trips</div>
        </div>
        {(() => {
          const upcomingItems: Array<{ id: string; title: string; type: string; travelDate: string; status: string; isBooking: boolean }> = [];
          quotes.forEach((q: QuoteWithJoins) => {
            if (!q.travel_date) return;
            const td = new Date(q.travel_date);
            if (td >= new Date() && !["LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status || "")) {
              upcomingItems.push({ id: q.id, title: q.title || q.holiday_type_name || "Trip", type: q.holiday_type_name || q.quote_type || "—", travelDate: q.travel_date, status: (q.quote_status || "NEW_LEAD").replace(/_/g, " "), isBooking: false });
            }
          });
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
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-4 text-center text-xs text-black/45" data-testid="empty-upcoming">
                No upcoming trips scheduled
              </div>
            );
          }
          return (
            <div className="grid gap-2">
              {upcoming.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition hover:bg-black/[0.03]"
                  data-testid={`upcoming-trip-${item.id}`}
                  onClick={() => navigate(`/clients/${clientId}/${item.isBooking ? "bookings" : "quotes"}/${item.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
                      <Plane className="h-4 w-4 text-black/50" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black/85" data-testid={`upcoming-title-${item.id}`}>
                        {item.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-black/55">
                        <span>{item.type}</span>
                        <span className="text-black/25">&middot;</span>
                        <span>{new Date(item.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.isBooking ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                      {item.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
