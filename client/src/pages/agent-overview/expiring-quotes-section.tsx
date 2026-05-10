import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useExpiringQuotes } from "@/hooks/queries";
import { currencyFull } from "./helpers";

export function ExpiringQuotesSection({
  userId,
  tab,
}: {
  userId: string;
  tab: string;
}) {
  const [, navigate] = useLocation();
  const [activityPage, setActivityPage] = useState(0);
  const { data: expiringQuotesData } = useExpiringQuotes(userId, {
    enabled: !!userId && tab === "pipeline",
  });

  return (
    <Card className="glass ringed grain rounded-3xl p-4" data-testid="card-expiring-quotes">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10">
            <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-black/80 dark:text-white/80">
              Expiring Quotes
            </div>
            <div className="text-[10px] text-black/45 dark:text-white/45">
              {expiringQuotesData && expiringQuotesData.length > 0
                ? `${expiringQuotesData.filter((q) => q.status === "expired").length} expired · ${expiringQuotesData.filter((q) => q.status === "near_expiry").length} near expiry`
                : "No expiring quotes"}
            </div>
          </div>
        </div>
      </div>
      {expiringQuotesData && expiringQuotesData.length > 0 ? (
        <>
          <div className="space-y-1.5">
            {expiringQuotesData
              .slice(activityPage * 10, activityPage * 10 + 10)
              .map((q) => {
                const isExpired = q.status === "expired";
                const expiryDate = new Date(q.expiryDate);
                const now = new Date();
                const diffMs = expiryDate.getTime() - now.getTime();
                const absDays = Math.floor(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
                const absHours = Math.floor(Math.abs(diffMs) / (60 * 60 * 1000));
                const label = isExpired
                  ? absDays === 0
                    ? "Expired today"
                    : absDays === 1
                      ? "Expired yesterday"
                      : `Expired ${absDays}d ago`
                  : absDays === 0
                    ? absHours < 1
                      ? "Expires soon"
                      : `Expires in ${absHours}h`
                    : absDays === 1
                      ? "Expires tomorrow"
                      : `Expires in ${absDays}d`;
                const price = q.salesPrice ? parseFloat(q.salesPrice) : 0;
                return (
                  <div
                    key={q.id}
                    className="group flex items-center gap-2.5 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7 cursor-pointer"
                    onClick={() => navigate(`/clients/${q.clientId || "_"}/quotes/${q.id}`)}
                    data-testid={`row-expiry-${q.id}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-black/10 ${isExpired ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"} dark:border-white/10`}
                    >
                      {isExpired ? (
                        <AlertCircle className="h-3.5 w-3.5" />
                      ) : (
                        <CalendarClock className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-semibold">{q.clientName}</div>
                        <div
                          className={`shrink-0 text-[10px] font-medium ${isExpired ? "text-rose-500" : "text-amber-500"}`}
                        >
                          {label}
                        </div>
                      </div>
                      <div className="truncate text-[10px] text-black/50 dark:text-white/50">
                        {price ? currencyFull.format(price) : "No price set"}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          {expiringQuotesData.length > 10 && (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[10px] text-black/40 dark:text-white/40">
                {activityPage * 10 + 1}–
                {Math.min(activityPage * 10 + 10, expiringQuotesData.length)} of{" "}
                {expiringQuotesData.length}
              </div>
              <div className="flex gap-1.5">
                {activityPage > 0 && (
                  <button
                    onClick={() => setActivityPage((p) => p - 1)}
                    className="rounded-xl border border-black/10 bg-black/5 px-2.5 py-1 text-[10px] font-medium text-black/60 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                  >
                    Previous
                  </button>
                )}
                {(activityPage + 1) * 10 < expiringQuotesData.length && (
                  <button
                    onClick={() => setActivityPage((p) => p + 1)}
                    className="rounded-xl border border-black/10 bg-black/5 px-2.5 py-1 text-[10px] font-medium text-black/60 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-3 py-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <CalendarClock className="mx-auto h-5 w-5 text-black/20 dark:text-white/20 mb-1.5" />
          <div className="text-[11px] text-black/40 dark:text-white/40">
            No quotes are near expiry or expired.
          </div>
        </div>
      )}
    </Card>
  );
}
