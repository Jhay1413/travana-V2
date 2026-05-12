import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2, Info, Pencil } from "lucide-react";
import { useTargetsVsActualsReport, reportKeys } from "@/hooks/queries";
import { useRole } from "@/hooks/use-role";
import AdminFinancialsTargets from "@/components/admin/admin-financials-targets";
import { currency, formatMonthLong } from "./helpers";
import { exportCsv } from "./csv";

function attainmentBadge(pct: number) {
  if (pct >= 100)
    return (
      <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
        {pct}%
      </Badge>
    );
  if (pct >= 85)
    return (
      <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
        {pct}%
      </Badge>
    );
  return (
    <Badge className="border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-500/10">
      {pct}%
    </Badge>
  );
}

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1];
}

export function TargetsVsActualsTab({ branchId }: { branchId?: string }) {
  const { orgRole } = useRole();
  const queryClient = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [editorOpen, setEditorOpen] = useState(false);
  const { data, isLoading, isError } = useTargetsVsActualsReport(year, branchId);

  const handleEditorOpenChange = (open: boolean) => {
    setEditorOpen(open);
    if (!open) {
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    }
  };

  const needsBranchSelection =
    !branchId && (orgRole === "org_admin" || orgRole === "platform_admin");

  if (needsBranchSelection) {
    return (
      <Card className="glass ringed grain rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          Targets are configured per branch. Select a branch in the filter strip to view targets vs actuals.
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading targets vs actuals…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Couldn't load the targets report.
      </div>
    );
  }

  const chartData = data.shop.map((r) => ({
    label: formatMonthLong(r.month, r.year),
    target: r.target,
    actual: r.actual,
  }));

  const handleExportShop = () => {
    exportCsv(
      `targets-shop-${year}`,
      data.shop.map((r) => ({
        month: formatMonthLong(r.month, r.year),
        target: r.target.toFixed(2),
        actual: r.actual.toFixed(2),
        attainmentPct: r.attainmentPct,
      })),
    );
  };

  const handleExportAgents = () => {
    exportCsv(
      `targets-agents-${year}`,
      data.agents.map((r) => ({
        agent: r.name,
        target: r.target.toFixed(2),
        actual: r.actual.toFixed(2),
        attainmentPct: r.attainmentPct,
      })),
    );
  };

  return (
    <div className="space-y-4" data-testid="targets-vs-actuals-report">
      <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Shop target vs actual</div>
            <div className="text-xs text-muted-foreground">12 months of {year}</div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
              <SelectTrigger className="h-9 w-28 rounded-xl" data-testid="targets-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions().map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              data-testid="targets-edit"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit targets
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportShop}
              data-testid="targets-shop-export"
            >
              <Download className="mr-1 h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => currency.format(v)}
                width={70}
              />
              <RechartsTooltip
                formatter={(value: number, name: string) => [currency.format(value), name === "target" ? "Target" : "Actual"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="target" fill="rgb(148 163 184)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="actual" fill="rgb(16 185 129)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Attainment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.shop.map((r) => (
              <TableRow key={`${r.year}-${r.month}`}>
                <TableCell className="font-medium">{formatMonthLong(r.month, r.year)}</TableCell>
                <TableCell className="text-right tabular-nums">{currency.format(r.target)}</TableCell>
                <TableCell className="text-right tabular-nums">{currency.format(r.actual)}</TableCell>
                <TableCell className="text-right">{attainmentBadge(r.attainmentPct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Agent attainment ({year})</div>
            <div className="text-xs text-muted-foreground">
              Targets summed across the year vs actual booking commission
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAgents}
            data-testid="targets-agents-export"
          >
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        {data.agents.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No agents in this branch.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Attainment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.agents.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency.format(r.target)}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency.format(r.actual)}</TableCell>
                  <TableCell className="text-right">{attainmentBadge(r.attainmentPct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-3xl"
          data-testid="targets-editor-sheet"
        >
          <SheetHeader>
            <SheetTitle>Edit targets</SheetTitle>
            <SheetDescription>
              Set monthly shop and per-agent targets. Changes save individually; close this panel to refresh the report.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <AdminFinancialsTargets />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
