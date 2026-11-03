import { useMemo } from "react";
import { useLocation } from "wouter";
import { usePipelineColumn } from "@/hooks/queries";
import { StagePill, formatCurrency } from "@/features/pipeline";
import { recentPipelineRows } from "../lib/pipeline-rows";
import { timeAgo } from "./dashboard-ui";
import { EmptyLine, HomeCard, HomeLink, PersonAvatar, RowButton } from "./home/home-ui";

export function PipelineSection({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const enabled = !!userId;
  // Same arguments as the live panel's "Latest" view so both share one cache entry.
  const enquiryQ = usePipelineColumn("enquiry", 10, userId, undefined, { enabled });
  const quoteQ = usePipelineColumn("quote", 10, userId, undefined, { enabled });
  const inPlayQ = usePipelineColumn("in_play", 10, userId, undefined, { enabled });

  const rows = useMemo(
    () =>
      recentPipelineRows(
        [inPlayQ, quoteQ, enquiryQ].flatMap((q) => q.data?.pages.flatMap((p) => p.items) ?? []),
      ),
    [enquiryQ.data, quoteQ.data, inPlayQ.data],
  );

  const isLoading = enquiryQ.isLoading || quoteQ.isLoading || inPlayQ.isLoading;

  return (
    <HomeCard
      title="Pipeline"
      testId="card-dashboard-pipeline"
      right={
        <HomeLink href="/pipeline" testId="link-dashboard-pipeline">
          Stage ›
        </HomeLink>
      }
    >
      {isLoading ? (
        <EmptyLine>Loading pipeline…</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine>No deals yet. Add an enquiry to get started.</EmptyLine>
      ) : (
        rows.map((row) => (
          <RowButton
            key={row.id}
            onActivate={() => navigate("/pipeline")}
            className="flex items-center gap-3 rounded-none border-t border-social-border py-2.5 hover:bg-social-page"
            testId={`row-dashboard-pipeline-${row.id}`}
          >
            <div className="flex min-w-0 flex-[1.3] items-center gap-2.5">
              <PersonAvatar name={row.customer} size={30} dark />
              <span className="truncate text-[13px] font-medium xl:text-[14px]">{row.customer}</span>
              <span className="hidden shrink-0 text-[11px] text-social-muted sm:inline">{timeAgo(row.createdAt)}</span>
            </div>
            <div className="hidden min-w-0 flex-1 truncate text-[13px] text-social-muted sm:block xl:text-[14px]">{row.title}</div>
            <div className="w-14 shrink-0 text-right text-[13px] font-medium xl:text-[14px]">{formatCurrency(row.profit)}</div>
            <div className="flex w-[84px] shrink-0 justify-end">
              <StagePill stage={row.stage} />
            </div>
          </RowButton>
        ))
      )}
    </HomeCard>
  );
}
