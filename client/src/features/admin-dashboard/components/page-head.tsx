import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_BRANCHES } from "../lib/branch-selection";
import { londonLongDate } from "../lib/dashboard-date";

interface PageHeadProps {
  organizationName: string | null | undefined;
  showBranchSelect: boolean;
  branches: Array<{ id: string; name: string }>;
  selectedBranch: string;
  onBranchChange: (value: string) => void;
}

export function PageHead({ organizationName, showBranchSelect, branches, selectedBranch, onBranchChange }: PageHeadProps) {
  const date = londonLongDate(new Date());
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight xl:text-2xl" data-testid="text-admin-dashboard-title">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-social-muted xl:text-[14px]" data-testid="text-admin-dashboard-subline">
          {organizationName ? `${organizationName} · ${date}` : date}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {showBranchSelect && (
          <Select value={selectedBranch} onValueChange={onBranchChange}>
            <SelectTrigger
              className="h-10 w-[190px] rounded-[10px] border-social-border bg-card px-3 text-[13px] shadow-none"
              data-testid="select-admin-dashboard-branch"
              aria-label="Branch"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={ALL_BRANCHES} className="text-[13px]">
                All branches
              </SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-[13px]">
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Link
          href="/pipeline"
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-social-orange px-5 text-[13px] font-semibold text-admin-on-accent transition hover:bg-social-orange/90"
          data-testid="link-admin-add-booking"
        >
          Add booking
        </Link>
      </div>
    </div>
  );
}
