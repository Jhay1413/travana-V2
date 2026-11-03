import { useState } from "react";
import { Link } from "wouter";
import { CirclePlus, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import { useBranches, useCurrentUser, useOrganizationAgentsPerformance } from "@/hooks/queries";
import { gbp } from "../lib/money";
import {
  filterTeamRows,
  showUnlistedRow,
  teamBranchId,
  teamFilterOptions,
  teamTotals,
  type TeamFilter,
} from "../lib/team-math";
import { CARD_BUTTON, CardHead, CardNote } from "./shared/bits";
import { TEAM_TD, TeamRow } from "./team-row";

const TH = "whitespace-nowrap px-3 pb-2.5 text-[12px] font-semibold text-social-muted xl:text-[13px]";
const TOTAL = `${TEAM_TD} bg-muted font-semibold`;

export function TeamPerformanceCard({ pageBranchId, className }: { pageBranchId?: string; className?: string }) {
  const [filter, setFilter] = useState<TeamFilter>("all");
  const { data: branches } = useBranches();
  const { data: me } = useCurrentUser();

  const options = teamFilterOptions(branches ?? [], pageBranchId !== undefined);
  // A stale selection (e.g. after the page selector changes) falls back to everyone, and the
  // query below only ever uses the filter the select is actually showing.
  const activeFilter = options.some((o) => o.value === filter) ? filter : "all";
  const agentsQ = useOrganizationAgentsPerformance({ range: "month", branchId: teamBranchId(pageBranchId, activeFilter) });
  const rows = filterTeamRows(agentsQ.data?.rows ?? [], activeFilter);
  const unlisted = agentsQ.data?.unlisted;
  const showUnlisted = showUnlistedRow(unlisted, activeFilter);
  const totals = teamTotals(rows, unlisted, showUnlisted);

  return (
    <HomeCard className={`flex min-w-0 flex-col ${className ?? ""}`} testId="card-multi-branch-stats">
      <CardHead
        id="team-performance-title"
        title="Team performance"
        sub="Targets here are each agent's own. The monthly target above is the agency's. Select a name to open their profile."
        right={
          <div className="flex items-center gap-2">
            <Select value={activeFilter} onValueChange={(v) => setFilter(v as TeamFilter)}>
              <SelectTrigger
                className="h-10 w-[170px] rounded-[10px] border-social-border bg-card px-3 text-[13px] shadow-none"
                data-testid="select-multi-branch-filter"
                aria-label="Show"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-[13px]">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link
              href="/agency/team/invite"
              aria-label="Add an agent"
              className="grid h-10 w-10 place-items-center rounded-[10px] border border-social-border bg-card text-social-muted hover:bg-muted hover:text-foreground"
              data-testid="link-multi-branch-add"
            >
              <CirclePlus className="h-5 w-5" />
            </Link>
          </div>
        }
      />

      {agentsQ.isLoading && !agentsQ.data ? (
        <div className="space-y-2" data-testid="multi-branch-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : agentsQ.isError ? (
        <CardNote tone="error" testId="multi-branch-error">
          Couldn't load agent stats.
        </CardNote>
      ) : rows.length === 0 && activeFilter === "homeworkers" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-7 text-center text-social-muted" data-testid="team-homeworkers-empty">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-status-draft-bg text-social-navy">
            <UserPlus className="h-6 w-6" aria-hidden />
          </span>
          {pageBranchId !== undefined ? (
            <span className="text-[13px]">Homeworkers aren&apos;t tied to a shop — clear the branch filter to see them.</span>
          ) : (
            <>
              <b className="text-foreground">No homeworkers yet</b>
              <span className="text-[13px]">Add a homeworker and they will appear here with their own target.</span>
              <Link href="/agency/team/invite" className={CARD_BUTTON}>
                Add a homeworker
              </Link>
            </>
          )}
        </div>
      ) : rows.length === 0 ? (
        <CardNote testId="multi-branch-empty">No agent data available</CardNote>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">Team performance today, this week and this month</caption>
            <thead>
              <tr className="border-b border-social-border">
                <th scope="col" className={`${TH} text-left`}>
                  Agent
                </th>
                {["Today", "This week", "This month", "Avg. per booking"].map((h) => (
                  <th key={h} scope="col" className={`${TH} text-right`}>
                    {h}
                  </th>
                ))}
                <th scope="col" className={`${TH} min-w-[190px] text-left`}>
                  Progress to target
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Open deals
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <TeamRow key={r.id} row={r} isMe={me?.id === r.id} />
              ))}
              {showUnlisted && unlisted && (
                <tr className="border-b border-social-border text-social-muted" data-testid="row-multi-branch-unlisted">
                  <td className={TEAM_TD}>Other / unassigned</td>
                  <td className={`${TEAM_TD} text-right tabular-nums`}>{gbp(unlisted.today)}</td>
                  <td className={`${TEAM_TD} text-right tabular-nums`}>{gbp(unlisted.week)}</td>
                  <td className={`${TEAM_TD} text-right tabular-nums`}>{gbp(unlisted.month)}</td>
                  <td className={`${TEAM_TD} text-right`}>–</td>
                  <td className={TEAM_TD}>–</td>
                  <td className={`${TEAM_TD} text-right`}>–</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr data-testid="row-multi-branch-totals">
                <td className={`${TOTAL} rounded-l-[10px]`}>Totals</td>
                <td className={`${TOTAL} text-right tabular-nums`}>{gbp(totals.today)}</td>
                <td className={`${TOTAL} text-right tabular-nums`}>{gbp(totals.week)}</td>
                <td className={`${TOTAL} text-right tabular-nums`}>{gbp(totals.month)}</td>
                <td className={`${TOTAL} text-right tabular-nums`}>{gbp(totals.avg)}</td>
                <td className={TOTAL}>{totals.target > 0 ? `${gbp(totals.toGo)} to go of ${gbp(totals.target)}` : "No targets set"}</td>
                <td className={`${TOTAL} rounded-r-[10px] text-right tabular-nums`}>{totals.openDeals ?? "–"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </HomeCard>
  );
}
