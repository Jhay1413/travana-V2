import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useRole } from "@/hooks/use-role";
import { useAdminOrgs } from "@/hooks/queries";
import { useActivateOrg, useStartImpersonation } from "@/hooks/mutations";
import type { OrgSummary } from "@/api/endpoints/platform-admin.api";
import { AlertCircle, Building2, Search, Download, Loader2, ShieldOff, ShieldCheck, Pencil, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuspendOrgDialog } from "@/components/platform-admin/suspend-org-dialog";
import { ChangePlanDialog } from "@/components/platform-admin/change-plan-dialog";
import { cn } from "@/lib/utils";

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
};

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function PlatformAdminPage() {
  const { role } = useRole();
  const allowed = role === "PlatformAdmin";

  const { data: orgs = [], isLoading, isError, error } = useAdminOrgs();
  const activate    = useActivateOrg();
  const impersonate = useStartImpersonation();
  const [, navigate] = useLocation();

  const [filter, setFilter] = useState("");
  const [suspendTarget,   setSuspendTarget]   = useState<OrgSummary | null>(null);
  const [planTarget,      setPlanTarget]      = useState<OrgSummary | null>(null);

  const handleImpersonate = async (orgId: string) => {
    try {
      await impersonate.mutateAsync(orgId);
      navigate("/");
    } catch (err) {
      console.error("Failed to impersonate:", err);
    }
  };

  const stats = useMemo(() => {
    const seatsLimit = orgs.reduce((s, o) => s + (o.seatLimit ?? 0), 0);
    const seatsUsed = orgs.reduce((s, o) => s + o.userCount, 0);
    const active = orgs.filter((o) => o.isActive).length;
    const suspended = orgs.filter((o) => !o.isActive).length;
    const branches = orgs.reduce((s, o) => s + o.branchCount, 0);
    return { seatsLimit, seatsUsed, active, suspended, branches };
  }, [orgs]);

  const visible = orgs.filter((o) => {
    const q = filter.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.slug.toLowerCase().includes(q) ||
      (o.plan ?? "").toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const header = ["Organization", "Slug", "Plan", "Users", "Branches", "Seat limit", "Status", "Created"];
    const rows = orgs.map((o) => [
      o.name,
      o.slug,
      o.plan ?? "",
      o.userCount,
      o.branchCount,
      o.seatLimit ?? "",
      o.isActive ? "active" : "suspended",
      formatDate(o.createdAt),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `platform-admin-orgs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!allowed) {
    return (
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
        <div className="font-semibold">Platform Admin only</div>
        <div className="text-sm text-black/60 dark:text-white/60">
          You don't have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total organizations" value={String(orgs.length)} testId="stat-total" />
        <Stat label="Active" value={String(stats.active)} accent="ok" testId="stat-active" />
        <Stat label="Suspended" value={String(stats.suspended)} testId="stat-suspended" />
        <Stat label="Branches" value={String(stats.branches)} testId="stat-branches" />
        <Stat label="Seats used" value={`${stats.seatsUsed} / ${stats.seatsLimit}`} testId="stat-seats" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name, slug or plan…"
            className="pl-9"
            data-testid="input-search-orgs"
          />
        </div>
        <Button onClick={exportCsv} variant="outline" className="gap-2" data-testid="button-export-csv">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Users</th>
              <th className="px-4 py-3 text-left">Branches</th>
              <th className="px-4 py-3 text-left">Seats</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-600">
                  Failed to load organizations: {(error as Error)?.message ?? "Unknown error"}
                </td>
              </tr>
            )}
            {!isLoading && !isError && visible.map((o) => (
              <OrgRow
                key={o.id}
                org={o}
                onOpen={() => navigate(`/platform-admin/organizations/${o.id}`)}
                onSuspend={() => setSuspendTarget(o)}
                onActivate={() => activate.mutate(o.id)}
                onChangePlan={() => setPlanTarget(o)}
                onImpersonate={() => handleImpersonate(o.id)}
                activating={activate.isPending && activate.variables === o.id}
                impersonating={impersonate.isPending && impersonate.variables === o.id}
              />
            ))}
            {!isLoading && !isError && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">
                  No organizations match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SuspendOrgDialog
        orgId={suspendTarget?.id ?? null}
        orgName={suspendTarget?.name ?? ""}
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
      />
      <ChangePlanDialog
        orgId={planTarget?.id ?? null}
        orgName={planTarget?.name ?? ""}
        currentPlan={planTarget?.plan ?? null}
        currentSeatLimit={planTarget?.seatLimit ?? null}
        open={!!planTarget}
        onOpenChange={(open) => !open && setPlanTarget(null)}
      />
    </div>
  );
}

function OrgRow({
  org,
  onOpen,
  onSuspend,
  onActivate,
  onChangePlan,
  onImpersonate,
  activating,
  impersonating,
}: {
  org: OrgSummary;
  onOpen: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onChangePlan: () => void;
  onImpersonate: () => void;
  activating: boolean;
  impersonating: boolean;
}) {
  const overSeats = org.seatLimit !== null && org.userCount > org.seatLimit;
  return (
    <tr className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-org-${org.id}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium">{org.name}</div>
            <div className="text-xs text-black/50 dark:text-white/50">/{org.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium dark:bg-white/10">
          {org.plan ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3" data-testid={`text-users-${org.id}`}>{org.userCount}</td>
      <td className="px-4 py-3" data-testid={`text-branches-${org.id}`}>{org.branchCount}</td>
      <td className="px-4 py-3" data-testid={`text-seats-${org.id}`}>
        <span className={cn(overSeats && "font-semibold text-amber-600")}>
          {org.userCount} / {org.seatLimit ?? "∞"}
        </span>
      </td>
      <td className="px-4 py-3">
        {org.isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
            active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
            suspended
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-black/50 dark:text-white/50">{formatDate(org.createdAt)}</td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-3">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1 text-xs font-medium text-black/70 hover:underline dark:text-white/80"
            data-testid={`button-open-${org.id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </button>
          <button
            onClick={onImpersonate}
            disabled={impersonating}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
            data-testid={`button-impersonate-${org.id}`}
          >
            {impersonating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            View as
          </button>
          <button
            onClick={onChangePlan}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            data-testid={`button-change-plan-${org.id}`}
          >
            <Pencil className="h-3.5 w-3.5" /> Plan
          </button>
          {org.isActive ? (
            <button
              onClick={onSuspend}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
              data-testid={`button-suspend-${org.id}`}
            >
              <ShieldOff className="h-3.5 w-3.5" /> Suspend
            </button>
          ) : (
            <button
              onClick={onActivate}
              disabled={activating}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
              data-testid={`button-activate-${org.id}`}
            >
              {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Reactivate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  accent,
  testId,
}: {
  label: string;
  value: string;
  accent?: "ok" | "warn";
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent === "warn"
          ? "border-amber-500/30 bg-amber-500/5"
          : accent === "ok"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5",
      )}
      data-testid={testId}
    >
      <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
