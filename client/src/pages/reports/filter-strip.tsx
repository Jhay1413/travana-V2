import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { useBranches } from "@/hooks/queries";
import { useUsers } from "@/hooks/queries/use-user-queries";
import { useRole } from "@/hooks/use-role";
import type { ReportFilters } from "@/api/endpoints/reports.api";
import { DateRangePicker } from "./date-range-picker";

const LEAD_SOURCES = [
  { value: "SHOP", label: "Shop" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "PHONE_ENQUIRY", label: "Phone" },
] as const;

interface FilterStripProps {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  /** Subset of `agentId | leadSource | branchId` to render disabled for the current tab. */
  inactiveKeys?: ReadonlyArray<keyof ReportFilters>;
}

const ALL = "__all__";

export function FilterStrip({ filters, onChange, inactiveKeys = [] }: FilterStripProps) {
  const { orgRole } = useRole();
  const showBranchSelector = orgRole === "org_admin" || orgRole === "platform_admin";
  const { data: branches = [] } = useBranches();
  const { data: users = [] } = useUsers();

  const isInactive = (k: keyof ReportFilters) => inactiveKeys.includes(k);

  const update = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });

  const resetSecondary = () =>
    onChange({ from: filters.from, to: filters.to });

  return (
    <Card
      className="glass ringed grain rounded-2xl p-3 md:p-4"
      data-testid="reports-filter-strip"
    >
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker
          from={filters.from ?? ""}
          to={filters.to ?? ""}
          onChange={(from, to) => update({ from, to })}
        />

        {showBranchSelector ? (
          <Select
            value={filters.branchId ?? ALL}
            onValueChange={(v) => update({ branchId: v === ALL ? undefined : v })}
            disabled={isInactive("branchId")}
          >
            <SelectTrigger className="h-10 w-[170px] rounded-xl" data-testid="filter-branch">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={filters.agentId ?? ALL}
          onValueChange={(v) => update({ agentId: v === ALL ? undefined : v })}
          disabled={isInactive("agentId")}
        >
          <SelectTrigger className="h-10 w-[170px] rounded-xl" data-testid="filter-agent">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All agents</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.firstName || u.name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.leadSource ?? ALL}
          onValueChange={(v) => update({ leadSource: v === ALL ? undefined : v })}
          disabled={isInactive("leadSource")}
        >
          <SelectTrigger className="h-10 w-[160px] rounded-xl" data-testid="filter-lead-source">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filters.branchId || filters.agentId || filters.leadSource) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSecondary}
            data-testid="filter-reset"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
