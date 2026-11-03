import type { OrgMemberBranch } from "@/features/organization/api/organization.api";

const PILL = "inline-flex max-w-[160px] items-center truncate rounded-full border border-social-border bg-muted/50 px-2.5 py-[3px] text-[12px] font-medium";

/** Active branches as pills; two at most, then "+n". */
export function BranchPills({ branches, limit = 2 }: { branches: OrgMemberBranch[]; limit?: number }) {
  const active = branches.filter((b) => b.isActive);
  const shown = active.length > 0 ? active : branches;
  if (shown.length === 0) return <span className="text-[12px] text-social-muted">No branch</span>;
  const head = shown.slice(0, limit);
  const rest = shown.length - head.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {head.map((b) => (
        <span key={b.branchId} className={PILL} title={b.branchName}>
          {b.branchName}
        </span>
      ))}
      {rest > 0 && <span className="text-[12px] font-semibold text-social-muted">+{rest}</span>}
    </div>
  );
}
