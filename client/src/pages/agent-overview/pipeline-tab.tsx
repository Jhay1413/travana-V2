import { useMemo } from "react";
import { useLocation } from "wouter";
import { usePipelineColumn } from "@/hooks/queries";
import { currency, getQuoteProfit } from "./helpers";

type PStage = "New Lead" | "In Play" | "Booked";

function getClientName(t: any): string {
  const c = t?.client;
  if (!c) return "Client";
  if (c.name) return c.name;
  const title = c.title && c.title !== "NULL" ? c.title : "";
  const composed = [title, c.firstName, c.surename].filter(Boolean).join(" ");
  return composed || "Client";
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
  if (stage === "In Play") {
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
  return {
    ...t,
    title: t.enquiry?.title || "New Enquiry",
    travel_date: t.enquiry?.travel_date || t.created_at,
    sales_price: null,
    package_commission: null,
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

  const newLeadQuery = usePipelineColumn("on_enquiry", 10, userId, undefined, { enabled });
  const inPlayQuery = usePipelineColumn("on_quote", 10, userId, undefined, { enabled });
  const bookedQuery = usePipelineColumn("on_booking", 10, userId, undefined, { enabled });

  const newLeadItems = useMemo(() => {
    if (!enabled || !newLeadQuery.data) return [];
    return newLeadQuery.data.pages.flatMap((p: any) => p.items as any[]).map((t) => mapItem("New Lead", t));
  }, [enabled, newLeadQuery.data]);

  const inPlayItems = useMemo(() => {
    if (!enabled || !inPlayQuery.data) return [];
    return inPlayQuery.data.pages.flatMap((p: any) => p.items as any[]).map((t) => mapItem("In Play", t));
  }, [enabled, inPlayQuery.data]);

  const bookedItems = useMemo(() => {
    if (!enabled || !bookedQuery.data) return [];
    return bookedQuery.data.pages.flatMap((p: any) => p.items as any[]).map((t) => mapItem("Booked", t));
  }, [enabled, bookedQuery.data]);

  const stages: { stage: PStage; hint: string; color: "blue" | "amber" | "emerald"; items: any[] }[] = [
    { stage: "New Lead", hint: "No commission yet", color: "blue", items: newLeadItems },
    { stage: "In Play", hint: "Commission added", color: "amber", items: inPlayItems },
    { stage: "Booked", hint: "Confirmed", color: "emerald", items: bookedItems },
  ];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {stages.map((col) => {
          const items = col.items;
          const sum = items.reduce((s: number, q: any) => s + getQuoteProfit(q), 0);
          const dotColor =
            col.color === "blue"
              ? "bg-blue-500"
              : col.color === "amber"
                ? "bg-amber-500"
                : "bg-emerald-500";
          const textColor =
            col.color === "blue"
              ? "text-blue-700"
              : col.color === "amber"
                ? "text-amber-700"
                : "text-emerald-700";
          return (
            <div key={col.stage} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                    <div className={`text-sm font-semibold ${textColor}`}>{col.stage}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {col.hint} · {items.length} quotes
                  </div>
                </div>
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {currency.format(sum)}
                </div>
              </div>

              <div className="space-y-2">
                {items.slice(0, 5).map((q: any) => (
                  <button
                    key={q.id}
                    onClick={() =>
                      navigate(
                        col.stage === "Booked"
                          ? `/clients/${q.transaction_id}/bookings/${q.booking?.id || q.id}`
                          : col.stage === "In Play"
                            ? `/clients/${q.transaction_id}/quotes/${q.quotes?.[0]?.id || q.id}`
                            : `/clients/${q.transaction_id}/enquiries/${q.enquiry?.id || q.id}`,
                      )
                    }
                    className="w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                    data-testid={`card-pipeline-${col.stage}-${q.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="truncate text-sm font-semibold"
                          data-testid={`text-pipeline-name-${q.id}`}
                        >
                          {q.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-black/55 dark:text-white/55">
                          {getClientName(q)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-black/40 dark:text-white/40">
                          {new Date(q.travel_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                      </div>
                      <div
                        className="text-xs font-semibold text-emerald-700"
                        data-testid={`text-pipeline-value-${q.id}`}
                      >
                        {getQuoteProfit(q) > 0 ? currency.format(getQuoteProfit(q)) : "TBC"}
                      </div>
                    </div>
                  </button>
                ))}
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
                    No quotes
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
