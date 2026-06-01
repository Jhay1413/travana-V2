import { useMemo } from "react";
import { useLocation } from "wouter";
import { MapPin, ChevronRight } from "lucide-react";
import { usePipelineColumn } from "@/hooks/queries";
import { currency, getQuoteProfit } from "./helpers";

type PStage = "Quotes" | "In Play" | "Booked";

const STAGE_META: Record<PStage, { hex: string; dot: string; text: string; hint: string }> = {
  "Quotes": { hex: "#F59E0B", dot: "bg-amber-500", text: "text-amber-700", hint: "Quoted" },
  "In Play": { hex: "#8B5CF6", dot: "bg-violet-500", text: "text-violet-700", hint: "Commission added" },
  "Booked": { hex: "#10B981", dot: "bg-emerald-500", text: "text-emerald-700", hint: "Confirmed" },
};

function getClientName(t: any): string {
  const c = t?.client;
  if (!c) return "Client";
  if (c.name) return c.name;
  const title = c.title && c.title !== "NULL" ? c.title : "";
  const composed = [title, c.firstName, c.surename].filter(Boolean).join(" ");
  return composed || "Client";
}

function getTimeAgo(d?: string | null): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getDest(t: any): { dest: string; country: string } {
  const q0 = t.quotes?.[0];
  const bk = t.booking;
  const dest = q0?.destination || bk?.destination || t.enquiry?.destination || "TBC";
  const country = q0?.country || bk?.country || t.enquiry?.country || "";
  return { dest, country };
}

function getTourOp(t: any): string | null {
  return t.quotes?.[0]?.main_tour_operator_name || t.booking?.main_tour_operator_name || null;
}

function getValue(t: any): number {
  if (t.quotes?.length) {
    return t.quotes.reduce(
      (s: number, q: any) =>
        s +
        (parseFloat(q.sales_price || "0") || 0) -
        (parseFloat(q.discounts || "0") || 0) +
        (parseFloat(q.service_charge || "0") || 0),
      0,
    );
  }
  if (t.booking) {
    return (
      (parseFloat(t.booking.sales_price || "0") || 0) -
      (parseFloat(t.booking.discounts || "0") || 0) +
      (parseFloat(t.booking.service_charge || "0") || 0)
    );
  }
  return 0;
}

function getAgentInitial(t: any): string {
  return t.assignedUser?.firstName?.[0]?.toUpperCase() || "?";
}

function getAgentName(t: any): string {
  const u = t.assignedUser;
  return u?.firstName || u?.username || "Unassigned";
}

function mapItem(stage: PStage, t: any): any {
  if (stage === "Booked") {
    return {
      ...t,
      title: t.enquiry?.title || t.booking?.title || "Untitled",
      travel_date: t.booking?.travel_date || t.enquiry?.travel_date || t.created_at,
      sales_price: t.booking?.sales_price || t.quotes?.[0]?.sales_price,
      package_commission:
        t.booking?.package_commission || t.quotes?.[0]?.package_commission,
      transaction_id: t.client_id,
    };
  }
  // Quotes and In Play both derive their figures from the main quote.
  const mainQuotes = (t.quotes ?? []).filter(
    (q: any) => !q.isFreeQuote && !q.isQuoteCopy,
  );
  const main = mainQuotes[0];
  return {
    ...t,
    title: main?.title || t.enquiry?.title || "Untitled",
    travel_date: main?.travel_date || t.enquiry?.travel_date || t.created_at,
    sales_price: main?.sales_price,
    package_commission: main?.package_commission,
    transaction_id: t.client_id,
  };
}

export function PipelineTab({
  userId,
  tab,
}: {
  userId: string;
  tab: string;
}) {
  const [, navigate] = useLocation();
  const enabled = tab === "pipeline" && !!userId;

  const quotesQuery = usePipelineColumn("quote", 10, userId, undefined, { enabled });
  const inPlayQuery = usePipelineColumn("in_play", 10, userId, undefined, { enabled });
  const bookedQuery = usePipelineColumn("booking", 10, userId, undefined, { enabled });

  const quotesItems = useMemo(() => {
    if (!enabled || !quotesQuery.data) return [];
    return quotesQuery.data.pages.flatMap((p: any) => p.items as any[]).map((t) => mapItem("Quotes", t));
  }, [enabled, quotesQuery.data]);

  const inPlayItems = useMemo(() => {
    if (!enabled || !inPlayQuery.data) return [];
    return inPlayQuery.data.pages.flatMap((p: any) => p.items as any[]).map((t) => mapItem("In Play", t));
  }, [enabled, inPlayQuery.data]);

  const bookedItems = useMemo(() => {
    if (!enabled || !bookedQuery.data) return [];
    return bookedQuery.data.pages.flatMap((p: any) => p.items as any[]).map((t) => mapItem("Booked", t));
  }, [enabled, bookedQuery.data]);

  const stages: { stage: PStage; items: any[] }[] = [
    { stage: "Quotes", items: quotesItems },
    { stage: "In Play", items: inPlayItems },
    { stage: "Booked", items: bookedItems },
  ];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {stages.map((col) => {
          const items = col.items;
          const meta = STAGE_META[col.stage];
          const sum = items.reduce((s: number, q: any) => s + getQuoteProfit(q), 0);
          return (
            <div key={col.stage} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <div className={`text-sm font-semibold ${meta.text}`}>{col.stage}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {meta.hint} · {items.length} deal{items.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {currency.format(sum)}
                </div>
              </div>

              <div className="space-y-2">
                {items.slice(0, 5).map((q: any) => {
                  const { dest, country } = getDest(q);
                  const value = getValue(q);
                  const profit = getQuoteProfit(q);
                  const tourOp = getTourOp(q);
                  const quoteCount = q.quotes?.length || 0;
                  const navUrl =
                    col.stage === "Booked"
                      ? `/clients/${q.transaction_id}/bookings/${q.booking?.id || q.id}`
                      : `/clients/${q.transaction_id}/quotes/${q.quotes?.[0]?.id || q.id}`;
                  return (
                    <button
                      key={q.id}
                      onClick={() => navigate(navUrl)}
                      className="group/card relative w-full overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition-all duration-200 hover:border-gray-200 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                      data-testid={`card-pipeline-${col.stage}-${q.id}`}
                    >
                      <div
                        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
                        style={{ backgroundColor: meta.hex }}
                      />
                      <div className="p-3.5 pl-4">
                        {/* Row 1: client name + time ago */}
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h4
                            className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900 dark:text-white"
                            data-testid={`text-pipeline-name-${q.id}`}
                          >
                            {getClientName(q)}
                          </h4>
                          <span className="flex-shrink-0 text-[11px] text-gray-400">
                            {getTimeAgo(q.created_at)}
                          </span>
                        </div>

                        {/* Row 2: title + destination */}
                        <p className="truncate text-[12px] font-medium text-gray-500 dark:text-white/60">
                          {q.title}
                        </p>
                        {dest !== "TBC" && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />
                            <span className="truncate text-[12px] text-gray-500 dark:text-white/60">
                              {dest}
                            </span>
                            {country && country !== dest && (
                              <span className="text-[11px] text-gray-400">· {country}</span>
                            )}
                          </div>
                        )}

                        {/* Row 3: value + profit */}
                        <div className="mb-1.5 mt-1.5 flex items-center gap-2">
                          <span
                            className="text-[13px] font-semibold text-gray-900 dark:text-white"
                            data-testid={`text-pipeline-value-${q.id}`}
                          >
                            {value > 0 ? currency.format(value) : "TBC"}
                          </span>
                          {profit > 0 && (
                            <span className="text-[11px] font-medium text-emerald-600">
                              Profit: {currency.format(profit)}
                            </span>
                          )}
                        </div>

                        {/* Row 4: footer — agent + tour op + quotes */}
                        <div className="flex items-center justify-between border-t border-gray-50 pt-1.5 dark:border-white/5">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-1">
                              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900">
                                <span className="text-[9px] font-medium text-white">
                                  {getAgentInitial(q)}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-500 dark:text-white/60">
                                {getAgentName(q)}
                              </span>
                            </div>
                            {tourOp && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="max-w-[100px] truncate text-[11px] text-gray-500 dark:text-white/60">
                                  {tourOp}
                                </span>
                              </>
                            )}
                            {quoteCount > 0 && col.stage !== "Booked" && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-[11px] text-gray-500 dark:text-white/60">
                                  {quoteCount} quote{quoteCount > 1 ? "s" : ""}
                                </span>
                              </>
                            )}
                          </div>
                          <ChevronRight className="ml-1 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                        </div>
                      </div>
                    </button>
                  );
                })}
                {items.length > 5 && (
                  <button
                    onClick={() => navigate("/pipeline")}
                    className="w-full rounded-2xl border border-dashed border-black/10 p-2 text-center text-xs text-black/50 hover:bg-black/5 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                  >
                    +{items.length - 5} more · View full pipeline
                  </button>
                )}
                {items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/10 p-3 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45">
                    No deals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={() => navigate("/pipeline")}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          data-testid="link-view-full-pipeline"
        >
          View full pipeline →
        </button>
      </div>
    </>
  );
}
