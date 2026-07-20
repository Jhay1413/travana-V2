import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Building2,
  Eye,
  Loader2,
  Pencil,
  ShieldOff,
  ShieldCheck,
  Users,
  GitBranch,
  Activity,
  MessageSquare,
  Plug,
  Gauge,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import {
  useAdminOrg,
  useAdminOrgUsers,
  useAdminOrgBranches,
  useAdminAuditLog,
} from "@/hooks/queries";
import {
  useActivateOrg,
  useStartImpersonation,
  useDeactivateUser,
  useReactivateUser,
} from "@/hooks/mutations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SuspendOrgDialog } from "@/features/platform-admin/components/platform-admin/suspend-org-dialog";
import { ChangePlanDialog } from "@/features/platform-admin/components/platform-admin/change-plan-dialog";
import { CreditsTab } from "@/features/platform-admin/components/platform-admin/credits-tab";
import { UsageTab } from "@/features/platform-admin/components/platform-admin/usage-tab";
import { RoleChipEditor } from "@/features/platform-admin/components/platform-admin/role-chip-editor";
import { SendSevenIntegrationCard } from "@/features/conversations";
import type { AdminUserRow } from "@/features/platform-admin/api/platform-admin.api";

const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}`;
};

export default function PlatformAdminOrgPage() {
  const { role } = useRole();
  const allowed = role === "PlatformAdmin";
  const [, params]   = useRoute("/platform-admin/organizations/:id");
  const [, navigate] = useLocation();
  const orgId = params?.id;

  const { data: org, isLoading: orgLoading } = useAdminOrg(orgId);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [planOpen, setPlanOpen]       = useState(false);
  const activate    = useActivateOrg();
  const impersonate = useStartImpersonation();

  const handleImpersonate = async () => {
    if (!orgId) return;
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
        <div className="font-semibold">Platform Admin only</div>
      </div>
    );
  }

  if (orgLoading || !org) {
    return (
      <div className="flex h-40 items-center justify-center text-black/50 dark:text-white/50">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/platform-admin")}
        className="inline-flex items-center gap-1 text-xs text-black/60 hover:underline dark:text-white/60"
        data-testid="button-back-orgs"
      >
        <ArrowLeft className="h-3 w-3" /> All organizations
      </button>

      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold" data-testid="text-org-name">{org.name}</div>
              <div className="text-xs text-black/50 dark:text-white/50">/{org.slug}</div>
            </div>
            {org.isActive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
                suspended
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setPlanOpen(true)} data-testid="button-change-plan">
              <Pencil className="mr-2 h-3.5 w-3.5" /> Plan
            </Button>
            {org.isActive ? (
              <Button variant="destructive" onClick={() => setSuspendOpen(true)} data-testid="button-suspend">
                <ShieldOff className="mr-2 h-3.5 w-3.5" /> Suspend
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => activate.mutate(org.id)}
                disabled={activate.isPending}
                data-testid="button-activate"
              >
                {activate.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                )}
                Reactivate
              </Button>
            )}
            <Button onClick={handleImpersonate} disabled={impersonate.isPending} data-testid="button-impersonate">
              {impersonate.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="mr-2 h-3.5 w-3.5" />
              )}
              View as
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Plan" value={org.plan ?? "—"} />
          <Metric label="Users" value={String(org.userCount)} />
          <Metric label="Branches" value={String(org.branchCount)} />
          <Metric label="Seat limit" value={org.seatLimit != null ? String(org.seatLimit) : "∞"} />
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="mr-1 h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="branches" data-testid="tab-branches">
            <GitBranch className="mr-1 h-3.5 w-3.5" /> Branches
          </TabsTrigger>
          <TabsTrigger value="credits" data-testid="tab-credits">
            <MessageSquare className="mr-1 h-3.5 w-3.5" /> Credits
          </TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">
            <Gauge className="mr-1 h-3.5 w-3.5" /> Usage
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <Activity className="mr-1 h-3.5 w-3.5" /> Audit
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Plug className="mr-1 h-3.5 w-3.5" /> Integrations
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersTab orgId={org.id} />
        </TabsContent>
        <TabsContent value="branches" className="mt-4">
          <BranchesTab orgId={org.id} />
        </TabsContent>
        <TabsContent value="credits" className="mt-4">
          <CreditsTab orgId={org.id} orgName={org.name} />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <UsageTab orgId={org.id} orgName={org.name} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab orgId={org.id} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <SendSevenIntegrationCard orgId={org.id} />
        </TabsContent>
      </Tabs>

      <SuspendOrgDialog
        orgId={org.id}
        orgName={org.name}
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
      />
      <ChangePlanDialog
        orgId={org.id}
        orgName={org.name}
        currentPlan={org.plan}
        currentSeatLimit={org.seatLimit}
        open={planOpen}
        onOpenChange={setPlanOpen}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function UsersTab({ orgId }: { orgId: string }) {
  const { data: users = [], isLoading } = useAdminOrgUsers(orgId);
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  if (isLoading) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }
  if (users.length === 0) {
    return <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">No users in this organization.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <table className="w-full text-sm">
        <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
          <tr>
            <th className="px-4 py-3 text-left">User</th>
            <th className="px-4 py-3 text-left">Roles</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow
              key={u.id}
              orgId={orgId}
              user={u}
              onDeactivate={() => deactivate.mutate({ orgId, userId: u.id })}
              onReactivate={() => reactivate.mutate({ orgId, userId: u.id })}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  orgId,
  user,
  onDeactivate,
  onReactivate,
}: {
  orgId: string;
  user: AdminUserRow;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const banned = !!user.banned;
  return (
    <tr className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-user-${user.id}`}>
      <td className="px-4 py-3">
        <div className="font-medium">{user.name || user.email}</div>
        <div className="text-xs text-black/50 dark:text-white/50">{user.email}</div>
      </td>
      <td className="px-4 py-3">
        <RoleChipEditor orgId={orgId} userId={user.id} disabled={banned} />
      </td>
      <td className="px-4 py-3">
        {banned ? (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
            deactivated
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
            active
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {banned ? (
          <button
            onClick={onReactivate}
            className="text-xs font-medium text-emerald-600 hover:underline"
            data-testid={`button-reactivate-user-${user.id}`}
          >
            Reactivate
          </button>
        ) : (
          <button
            onClick={onDeactivate}
            className="text-xs font-medium text-red-600 hover:underline"
            data-testid={`button-deactivate-user-${user.id}`}
          >
            Deactivate
          </button>
        )}
      </td>
    </tr>
  );
}

function BranchesTab({ orgId }: { orgId: string }) {
  const { data: branches = [], isLoading } = useAdminOrgBranches(orgId);

  if (isLoading) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }
  if (branches.length === 0) {
    return <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">No branches in this organization.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <table className="w-full text-sm">
        <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
          <tr>
            <th className="px-4 py-3 text-left">Branch</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Members</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-branch-${b.id}`}>
              <td className="px-4 py-3">
                <div className="font-medium">{b.name}</div>
                {b.code && <div className="text-xs text-black/50 dark:text-white/50">{b.code}</div>}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{b.branchType}</span>
              </td>
              <td className="px-4 py-3">{b.memberCount}</td>
              <td className="px-4 py-3">
                {b.isActive ? (
                  <span className="text-xs text-emerald-700">active</span>
                ) : (
                  <span className="text-xs text-red-700">inactive</span>
                )}
                {b.isDefault && <span className="ml-2 text-xs text-black/50">(default)</span>}
              </td>
              <td className="px-4 py-3 text-xs text-black/50 dark:text-white/50">{formatDate(b.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab({ orgId }: { orgId: string }) {
  const { data: entries = [], isLoading } = useAdminAuditLog({ orgId, limit: 100 });

  if (isLoading) {
    return <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-black/40" /></div>;
  }
  if (entries.length === 0) {
    return <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">No admin actions recorded against this organization.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <table className="w-full text-sm">
        <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
          <tr>
            <th className="px-4 py-3 text-left">When</th>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3 text-left">Actor</th>
            <th className="px-4 py-3 text-left">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-black/5 align-top last:border-0 dark:border-white/10" data-testid={`row-audit-${e.id}`}>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-black/60 dark:text-white/60">{formatDateTime(e.createdAt)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-xs dark:bg-white/10">{e.action}</span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-black/60 dark:text-white/60">{e.actorUserId.slice(0, 12)}…</td>
              <td className="max-w-md px-4 py-3 text-xs">
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-black/60 dark:text-white/60">{JSON.stringify(e.metadata, null, 0)}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
