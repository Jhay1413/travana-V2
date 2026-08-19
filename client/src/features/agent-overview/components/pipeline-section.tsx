import { useMemo } from "react";
import { useLocation } from "wouter";
import { ChevronRight, CircleStar, Landmark, SquarePlus } from "lucide-react";
import { usePipelineColumn } from "@/hooks/queries";
import type { Transaction } from "@/features/quote/types";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";
import { DashboardCard, InitialsAvatar, timeAgo } from "./dashboard-ui";

type Stage = "in_play" | "quote" | "enquiry";

const STAGE_BADGE: Record<Stage, { label: string; className: string; icon: React.ElementType }> = {
  in_play: {
    label: "In-Play",
    className: "border border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-500/10",
    icon: CircleStar,
  },
  quote: {
    label: "Quoted",
    className: "bg-blue-500 text-white",
    icon: Landmark,
  },
  enquiry: {
    label: "Enquiry",
    className: "bg-emerald-500 text-white",
    icon: SquarePlus,
  },
};

function dealTitle(t: Transaction): string {
  return t.enquiry?.title || t.quotes?.[0]?.title || t.booking?.title || `#${t.id.slice(0, 8)}`;
}

function dealProfit(t: Transaction): number {
  if (t.quotes?.length) {
    return t.quotes.reduce((s, q) => {
      const pkg = parseFloat((q as any).package_commission || "0") || 0;
      const svc = parseFloat((q as any).service_commission || "0") || 0;
      return s + pkg + svc;
    }, 0);
  }
  if (t.booking) return parseFloat(t.booking.package_commission || "0") || 0;
  return 0;
}

export function PipelineSection({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const enabled = !!userId;
  const enquiryQ = usePipelineColumn("enquiry", 10, userId, undefined, { enabled });
  const quoteQ = usePipelineColumn("quote", 10, userId, undefined, { enabled });
  const inPlayQ = usePipelineColumn("in_play", 10, userId, undefined, { enabled });

  const rows = useMemo(() => {
    const withStage = (q: typeof enquiryQ, stage: Stage) =>
      (q.data?.pages.flatMap((p) => p.items) ?? []).map((t) => ({ t, stage }));
    return [
      ...withStage(inPlayQ, "in_play"),
      ...withStage(quoteQ, "quote"),
      ...withStage(enquiryQ, "enquiry"),
    ]
      .sort((a, b) => new Date(b.t.created_at).getTime() - new Date(a.t.created_at).getTime())
      .slice(0, 7);
  }, [enquiryQ.data, quoteQ.data, inPlayQ.data]);

  const isLoading = enquiryQ.isLoading || quoteQ.isLoading || inPlayQ.isLoading;

  return (
    <DashboardCard className="min-w-0" testId="card-dashboard-pipeline">
      <div className="text-base font-semibold">Pipeline</div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-left">
          <thead>
            <tr className="border-b border-black/10 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="py-2 pr-2 font-medium">Client</th>
              <th className="py-2 pr-2 font-medium">Deal</th>
              <th className="py-2 pr-2 font-medium">Profit</th>
              <th className="py-2 font-medium">
                <span className="inline-flex items-center gap-0.5">
                  Stage <ChevronRight className="h-3 w-3" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                  Loading pipeline…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                  No deals in your pipeline
                </td>
              </tr>
            ) : (
              rows.map(({ t, stage }) => {
                const badge = STAGE_BADGE[stage];
                const BadgeIcon = badge.icon;
                const clientName = (t as any).client_name || t.client?.name || "Unknown Client";
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate("/pipeline")}
                    className="cursor-pointer border-b border-black/5 transition last:border-b-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
                    data-testid={`row-dashboard-pipeline-${t.id}`}
                  >
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <InitialsAvatar name={clientName} solid className="h-7 w-7" />
                        <span className="truncate text-sm font-semibold">{clientName}</span>
                        <span className="shrink-0 text-[10px] text-black/40 dark:text-white/40">
                          {timeAgo(t.created_at)}
                        </span>
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate py-2.5 pr-2 text-sm">{dealTitle(t)}</td>
                    <td className="py-2.5 pr-2 text-sm font-medium">{currency.format(dealProfit(t))}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold",
                          badge.className,
                        )}
                      >
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
