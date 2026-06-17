import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReportFilters } from "@/features/reports/api/reports.api";
import { FilterStrip } from "./filter-strip";
import { SalesReportTab } from "./sales-report";
import { AgentPerformanceTab } from "./agent-performance-report";
import { LeadSourceTab } from "./lead-source-report";
import { TargetsVsActualsTab } from "./targets-vs-actuals-report";
import { firstOfMonthIso, todayIso } from "./helpers";

type TabKey = "sales" | "agents" | "lead-source" | "targets";

const FILTER_USAGE: Record<TabKey, ReadonlyArray<keyof ReportFilters>> = {
  sales: [],
  agents: ["agentId"],
  "lead-source": ["agentId", "leadSource"],
  targets: ["agentId", "leadSource"],
};

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("sales");
  const [filters, setFilters] = useState<ReportFilters>(() => ({
    from: firstOfMonthIso(),
    to: todayIso(),
  }));

  const inactiveKeys = useMemo(() => FILTER_USAGE[tab], [tab]);

  return (
    <section className="space-y-4" data-testid="reports-page">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      <FilterStrip
        filters={filters}
        onChange={setFilters}
        inactiveKeys={inactiveKeys}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="reports-tabs">
          <TabsTrigger value="sales" className="rounded-xl">
            Sales
          </TabsTrigger>
          <TabsTrigger value="agents" className="rounded-xl">
            Agents
          </TabsTrigger>
          <TabsTrigger value="lead-source" className="rounded-xl">
            Lead source
          </TabsTrigger>
          <TabsTrigger value="targets" className="rounded-xl">
            Targets vs actuals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <SalesReportTab filters={filters} />
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <AgentPerformanceTab filters={filters} />
        </TabsContent>
        <TabsContent value="lead-source" className="mt-4">
          <LeadSourceTab filters={filters} />
        </TabsContent>
        <TabsContent value="targets" className="mt-4">
          <TargetsVsActualsTab branchId={filters.branchId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
