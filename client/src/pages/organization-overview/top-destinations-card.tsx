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
import type { OrganizationOverviewTopRow } from "@/api/endpoints/organization-overview.api";

type TopTab = "destinations" | "resorts" | "tour-operators";

const TAB_LABEL: Record<TopTab, string> = {
  destinations: "Destinations",
  resorts: "Resorts",
  "tour-operators": "Tour Operators",
};

export function TopDestinationsCard({
  destinations,
  resorts,
  tourOperators,
}: {
  destinations: OrganizationOverviewTopRow[];
  resorts: OrganizationOverviewTopRow[];
  tourOperators: OrganizationOverviewTopRow[];
}) {
  const [tab, setTab] = useState<TopTab>("destinations");
  const rows =
    tab === "destinations" ? destinations : tab === "resorts" ? resorts : tourOperators;

  return (
    <Card
      className="glass ringed grain rounded-2xl p-4 md:p-5"
      data-testid="top-destinations-card"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Top {TAB_LABEL[tab]}</div>
          <div className="text-xs text-muted-foreground">Year to date · agency-wide</div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TopTab)}>
          <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5">
            <TabsTrigger value="destinations" className="rounded-xl" data-testid="tab-destinations">
              Destinations
            </TabsTrigger>
            <TabsTrigger value="resorts" className="rounded-xl" data-testid="tab-resorts">
              Resorts
            </TabsTrigger>
            <TabsTrigger value="tour-operators" className="rounded-xl" data-testid="tab-tour-operators">
              Tour Operators
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
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.name} data-testid={`row-top-${tab}-${idx}`}>
                <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.bookings.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency.format(row.commission)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
