import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency } from "./helpers";
import type { BranchOverviewTopRow } from "@/api/endpoints/branch-overview.api";

export function TopDestinationsCard({
  destinations,
  resorts,
}: {
  destinations: BranchOverviewTopRow[];
  resorts: BranchOverviewTopRow[];
}) {
  const [tab, setTab] = useState<"destinations" | "resorts">("destinations");
  const rows = tab === "destinations" ? destinations : resorts;

  return (
    <Card className="glass ringed grain rounded-2xl p-4 md:p-5" data-testid="top-destinations-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Top {tab}</div>
          <div className="text-xs text-muted-foreground">Year to date</div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "destinations" | "resorts")}>
          <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5">
            <TabsTrigger value="destinations" className="rounded-xl">
              Destinations
            </TabsTrigger>
            <TabsTrigger value="resorts" className="rounded-xl">
              Resorts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No bookings in this period.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.bookings.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency.format(row.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
