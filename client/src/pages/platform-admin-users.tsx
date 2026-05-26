import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useAdminOrgs, useAdminUsers } from "@/hooks/queries";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_ORGS = "__ALL_ORGS__";

const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export default function PlatformAdminUsersPage() {
  const { role } = useRole();
  const allowed = role === "PlatformAdmin";
  const [, navigate] = useLocation();

  const [orgId, setOrgId]   = useState("");
  const [search, setSearch] = useState("");

  const { data: orgs = [] } = useAdminOrgs();
  const { data: users = [], isLoading, isError, error } = useAdminUsers({
    orgId:  orgId  || undefined,
    search: search.trim() || undefined,
    limit:  200,
  });

  const orgsById = useMemo(() => {
    const map = new Map<string, string>();
    orgs.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [orgs]);

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
        <div className="text-lg font-semibold">All users</div>
        <div className="text-sm text-black/50 dark:text-white/50">Every user across every organization.</div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <Select value={orgId || ALL_ORGS} onValueChange={(v) => setOrgId(v === ALL_ORGS ? "" : v)}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-filter-org">
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ORGS}>All organizations</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Organization</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-black/40" /></td></tr>
            )}
            {isError && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">Failed to load users: {(error as Error)?.message ?? "Unknown error"}</td></tr>
            )}
            {!isLoading && !isError && users.map((u) => {
              const orgName = u.orgId ? orgsById.get(u.orgId) : null;
              return (
                <tr key={u.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-user-${u.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name || u.email}</div>
                    <div className="text-xs text-black/50 dark:text-white/50">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {orgName ? (
                      <button
                        onClick={() => u.orgId && navigate(`/platform-admin/organizations/${u.orgId}`)}
                        className="text-blue-600 hover:underline"
                        data-testid={`link-org-${u.orgId}`}
                      >
                        {orgName}
                      </button>
                    ) : (
                      <span className="text-black/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{u.orgRole ?? u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">deactivated</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-black/50 dark:text-white/50">{formatDate(u.createdAt)}</td>
                </tr>
              );
            })}
            {!isLoading && !isError && users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">No users match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
