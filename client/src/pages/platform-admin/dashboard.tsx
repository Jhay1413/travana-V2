import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  Activity,
  Building2,
  Users,
  GitBranch,
  ShieldCheck,
  ShieldOff,
  Eye,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useAdminOrgs, useAdminAuditLog } from "@/hooks/queries";
import { useStartImpersonation } from "@/hooks/mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrgSummary, AdminAuditEntry } from "@/features/platform-admin/api/platform-admin.api";

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}`;
};

const ACTION_LABELS: Record<string, string> = {
  "org.suspend":               "Suspended org",
  "org.activate":              "Activated org",
  "org.plan.change":           "Changed plan",
  "org.impersonate.start":     "Started impersonating",
  "org.impersonate.stop":      "Stopped impersonating",
  "org.credit.limit.change":   "Changed credit limit",
  "org.credit.price.change":   "Changed overage price",
  "org.credit.topup":          "Granted credits",
  "org.credit.charge.write_off": "Wrote off charge",
  "user.role.change":          "Changed user role",
  "user.deactivate":           "Deactivated user",
  "user.reactivate":           "Reactivated user",
};

export default function PlatformAdminDashboard() {
  const { role } = useRole();
  const allowed = role === "PlatformAdmin";
  const [, navigate] = useLocation();

  const { data: orgs = [], isLoading: orgsLoading } = useAdminOrgs();
  const { data: audit = [], isLoading: auditLoading } = useAdminAuditLog({ limit: 10 });
  const impersonate = useStartImpersonation();

  const stats = useMemo(() => {
    const seatsLimit = orgs.reduce((s, o) => s + (o.seatLimit ?? 0), 0);
    const seatsUsed  = orgs.reduce((s, o) => s + o.userCount, 0);
    const active     = orgs.filter((o) => o.isActive).length;
    const suspended  = orgs.filter((o) => !o.isActive).length;
    const branches   = orgs.reduce((s, o) => s + o.branchCount, 0);
    return { seatsLimit, seatsUsed, active, suspended, branches };
  }, [orgs]);

  const recentOrgs = orgs.slice(0, 5);
  const orgsById   = useMemo(() => {
    const map = new Map<string, string>();
    orgs.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [orgs]);

  const handleImpersonate = async (orgId: string) => {
    try {
      await impersonate.mutateAsync(orgId);
      navigate("/");
    } catch (err) {
      console.error("Failed to impersonate:", err);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
        <div className="font-semibold">Platform Admin only</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Platform overview</div>
        <div className="text-sm text-black/50 dark:text-white/50">
          Cross-tenant health, recent organizations, and admin activity.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Organizations" value={String(orgs.length)} icon={Building2} loading={orgsLoading} testId="kpi-orgs" />
        <Kpi label="Active" value={String(stats.active)} icon={ShieldCheck} accent="ok" loading={orgsLoading} testId="kpi-active" />
        <Kpi label="Suspended" value={String(stats.suspended)} icon={ShieldOff} accent={stats.suspended > 0 ? "warn" : undefined} loading={orgsLoading} testId="kpi-suspended" />
        <Kpi label="Users" value={`${stats.seatsUsed} / ${stats.seatsLimit}`} icon={Users} loading={orgsLoading} testId="kpi-users" />
        <Kpi label="Branches" value={String(stats.branches)} icon={GitBranch} loading={orgsLoading} testId="kpi-branches" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title="Recent organizations"
          icon={Building2}
          actionLabel="View all"
          onAction={() => navigate("/platform-admin/organizations")}
          className="lg:col-span-3"
        >
          {orgsLoading ? (
            <Skeleton rows={4} />
          ) : recentOrgs.length === 0 ? (
            <Empty>No organizations yet.</Empty>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {recentOrgs.map((o) => (
                <RecentOrgRow
                  key={o.id}
                  org={o}
                  onOpen={() => navigate(`/platform-admin/organizations/${o.id}`)}
                  onImpersonate={() => handleImpersonate(o.id)}
                  impersonating={impersonate.isPending && impersonate.variables === o.id}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent admin activity"
          icon={Activity}
          actionLabel="Open log"
          onAction={() => navigate("/platform-admin/audit-log")}
          className="lg:col-span-2"
        >
          {auditLoading ? (
            <Skeleton rows={5} />
          ) : audit.length === 0 ? (
            <Empty>No admin actions recorded yet.</Empty>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {audit.slice(0, 8).map((e) => (
                <AuditRow key={e.id} entry={e} orgName={e.targetOrgId ? orgsById.get(e.targetOrgId) : undefined} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  loading,
  testId,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "ok" | "warn";
  loading?: boolean;
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
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">{label}</div>
        <Icon className="h-4 w-4 text-black/40 dark:text-white/40" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {loading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-black/10 dark:bg-white/10" /> : value}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  actionLabel,
  onAction,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5", className)}>
      <div className="flex items-center justify-between border-b border-black/5 p-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-black/60 dark:text-white/60" />
          <div className="font-medium">{title}</div>
        </div>
        {actionLabel && onAction && (
          <Button variant="ghost" size="sm" onClick={onAction} className="gap-1 text-xs">
            {actionLabel} <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function RecentOrgRow({
  org,
  onOpen,
  onImpersonate,
  impersonating,
}: {
  org: OrgSummary;
  onOpen: () => void;
  onImpersonate: () => void;
  impersonating: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4" data-testid={`row-org-${org.id}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-medium">{org.name}</div>
            {org.isActive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                suspended
              </span>
            )}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">
            /{org.slug} · {org.userCount} {org.userCount === 1 ? "user" : "users"} · {org.branchCount} {org.branchCount === 1 ? "branch" : "branches"} · {org.plan ?? "—"}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={onImpersonate}
          disabled={impersonating}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
          data-testid={`button-impersonate-${org.id}`}
        >
          <Eye className="h-3.5 w-3.5" /> View as
        </button>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-xs font-medium text-black/70 hover:underline dark:text-white/80"
          data-testid={`button-open-${org.id}`}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </button>
      </div>
    </div>
  );
}

function AuditRow({ entry, orgName }: { entry: AdminAuditEntry; orgName?: string }) {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  return (
    <div className="p-3 text-sm" data-testid={`audit-${entry.id}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-medium">{label}</div>
        <div className="shrink-0 text-[11px] text-black/40 dark:text-white/40">{formatDateTime(entry.createdAt)}</div>
      </div>
      <div className="mt-0.5 text-xs text-black/55 dark:text-white/55">
        {orgName ?? <span className="text-black/35">no org</span>}
        <span className="px-1.5 text-black/30">·</span>
        <span className="font-mono">{entry.action}</span>
      </div>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-black/5 dark:divide-white/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-black/5 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-black/5 dark:bg-white/10" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-black/5 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-6 text-center text-sm text-black/50 dark:text-white/50">{children}</div>;
}
