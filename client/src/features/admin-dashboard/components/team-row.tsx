import { Link } from "wouter";
import { PersonAvatar } from "@/components/shared/person-avatar";
import type { AgentPerformanceRow } from "@/features/organization/api/organization-overview.api";
import { gbp } from "../lib/money";
import { rowBranchLabel, rowPpb, targetProgressPct, toGo } from "../lib/team-math";
import { AdminProgress } from "./shared/bits";
import { StatusPill } from "./shared/pills";

export const TEAM_TD = "px-3 py-3 align-middle text-[13px] xl:text-[14px]";
const NUM = `${TEAM_TD} text-right tabular-nums`;

export function TeamRow({ row, isMe }: { row: AgentPerformanceRow; isMe: boolean }) {
  const hasTarget = row.target > 0;
  const pct = targetProgressPct(row.target, row.month);
  return (
    <tr
      className={`border-b border-social-border ${isMe ? "bg-social-orange/10" : ""}`}
      data-testid={`row-multi-branch-agent-${row.id}`}
    >
      <td className={TEAM_TD}>
        <div className="flex items-center gap-3">
          {row.avatarUrl ? (
            <img src={row.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <PersonAvatar name={row.name} size={36} />
          )}
          <div className="min-w-0">
            <Link
              href={`/agents/${row.id}`}
              className="block font-semibold leading-tight text-social-navy hover:underline"
              data-testid={`link-team-agent-${row.id}`}
            >
              {row.name}
              {isMe ? " (you)" : ""}
            </Link>
            <small className="text-[12px] text-social-muted">{rowBranchLabel(row)}</small>
          </div>
        </div>
      </td>
      <td className={NUM}>{gbp(row.today)}</td>
      <td className={NUM}>{gbp(row.week)}</td>
      <td className={NUM}>{gbp(row.month)}</td>
      <td className={NUM}>{gbp(rowPpb(row))}</td>
      <td className={`${TEAM_TD} min-w-[190px]`}>
        {hasTarget ? (
          <>
            <AdminProgress pct={pct} tone="navy" label={`${row.name} has reached ${pct} percent of target`} />
            <div className="mt-1.5 text-[12px] text-social-muted xl:text-[13px]">
              {gbp(toGo(row.target, row.month))} to go of {gbp(row.target)}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="plain">No target set</StatusPill>
            <Link href="/agency/targets/agents" className="text-[12px] font-semibold text-social-orange-text hover:underline xl:text-[13px]">
              Set target
            </Link>
          </div>
        )}
      </td>
      <td className={NUM}>{row.openDeals ?? "–"}</td>
    </tr>
  );
}
