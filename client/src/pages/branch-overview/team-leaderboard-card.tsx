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
import { Trophy } from "lucide-react";
import { currency } from "./helpers";
import type { BranchOverviewTeamRow } from "@/api/endpoints/branch-overview.api";

export function TeamLeaderboardCard({ rows }: { rows: BranchOverviewTeamRow[] }) {
  return (
    <Card className="glass ringed grain rounded-2xl p-4 md:p-5" data-testid="team-leaderboard-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-amber-500" />
            Team leaderboard
          </div>
          <div className="text-xs text-muted-foreground">This month — sorted by commission</div>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} members</span>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">No team members.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Quotes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.id}>
                <TableCell>
                  {idx === 0 ? (
                    <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                      1
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.bookings.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {currency.format(row.commission)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.quotes.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
