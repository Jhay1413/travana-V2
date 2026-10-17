import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MemberFilters } from "../../lib/member-filters";
import { ASSIGNABLE_ROLES } from "../../lib/role-helpers";
import type { StatusTab } from "../../types";
import { TEAM_CONTROL } from "../shared/team-styles";

interface MemberToolbarProps {
  filters: MemberFilters;
  onChange: (patch: Partial<MemberFilters>) => void;
  counts: { active: number; suspended: number };
  branches: Array<{ id: string; name: string }>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn(TEAM_CONTROL, "w-[170px] xl:w-[190px]")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

/** Active | Suspended segments, role and branch filters, and search. Sits on the card, no extra box. */
export function MemberToolbar({ filters, onChange, counts, branches }: MemberToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4 xl:px-5" data-testid="member-toolbar">
      <Segmented<StatusTab>
        label="Member status"
        variant="black"
        value={filters.status}
        onChange={(status) => onChange({ status })}
        items={[
          { value: "active", label: "Active", count: counts.active, testId: "tab-team-active" },
          { value: "suspended", label: "Suspended", count: counts.suspended, testId: "tab-team-suspended" },
        ]}
      />
      <FilterSelect label="Filter by role" value={filters.role} onChange={(role) => onChange({ role })}>
        <SelectItem value="all">All roles</SelectItem>
        {ASSIGNABLE_ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </FilterSelect>
      <FilterSelect label="Filter by branch" value={filters.branchId} onChange={(branchId) => onChange({ branchId })}>
        <SelectItem value="all">All branches</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </FilterSelect>
      <div className="flex-1" />
      <label className="flex h-10 w-[300px] max-w-full shrink-0 items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[12px] xl:text-[13px]">
        <Search className="h-4 w-4 shrink-0 text-social-muted" />
        <input
          type="search"
          maxLength={100}
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Search by name, email or branch"
          aria-label="Search by name, email or branch"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-social-muted"
          data-testid="input-team-filter"
        />
      </label>
    </div>
  );
}
