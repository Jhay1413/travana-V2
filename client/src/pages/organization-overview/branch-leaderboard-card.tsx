import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";
import type { OrganizationOverviewBranchRow } from "@/api/endpoints/organization-overview.api";

function AchievedBar({ percent, hasTarget }: { percent: number; hasTarget: boolean }) {
  if (!hasTarget) return <span className="text-xs text-muted-foreground">—</span>;
  const capped = Math.min(100, Math.max(0, percent));
  const over = percent > 100;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", over ? "bg-emerald-500" : "bg-blue-500")}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className="tabular-nums text-xs font-semibold">{Math.round(percent)}%</span>
    </div>
  );
}

export function BranchLeaderboardCard({ rows }: { rows: OrganizationOverviewBranchRow[] }) {
  return (
    <Card
      className="glass ringed grain rounded-2xl p-4 md:p-5"
      data-testid="branch-leaderboard-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-indigo-500" />
            Branch leaderboard
          </div>
          <div className="text-xs text-muted-foreground">
            This month — sorted by commission
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} branches</span>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No branches yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Achieved %</TableHead>
                <TableHead className="text-right">Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.id} data-testid={`row-branch-${row.id}`}>
                  <TableCell>
                    {idx === 0 ? (
                      <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                        1
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{row.name}</span>
                      {row.code ? (
                        <span className="text-[10px] text-muted-foreground">{row.code}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.bookings.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {currency.format(row.commission)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quotes.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.monthTarget > 0 ? currency.format(row.monthTarget) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <AchievedBar percent={row.percentToTarget} hasTarget={row.monthTarget > 0} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.memberCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
