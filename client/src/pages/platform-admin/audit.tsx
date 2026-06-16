import { useMemo, useState } from "react";
import { useRole } from "@/hooks/use-role";
import { useAdminAuditLog, useAdminOrgs } from "@/hooks/queries";
import type { AdminAuditEntry } from "@/api/endpoints/platform-admin.api";
import { AlertCircle, Activity, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_OPTIONS = [
  "org.suspend",
  "org.activate",
  "org.plan.change",
  "org.impersonate.start",
  "org.impersonate.stop",
];

const ALL_ORGS = "__ALL_ORGS__";
const ALL_ACTIONS = "__ALL_ACTIONS__";

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}`;
};

export default function PlatformAdminAuditPage() {
  const { role } = useRole();
  const allowed = role === "PlatformAdmin";

  const [orgId, setOrgId]     = useState<string>("");
  const [action, setAction]   = useState<string>("");
  const [search, setSearch]   = useState("");

  const { data: orgs = [] } = useAdminOrgs();
  const { data: entries = [], isLoading, isError, error } = useAdminAuditLog({
    orgId:  orgId || undefined,
    action: action || undefined,
    limit:  200,
  });

  const orgsById = useMemo(() => {
    const map = new Map<string, string>();
    orgs.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [orgs]);

  const visible = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) =>
      e.action.toLowerCase().includes(q) ||
      (e.targetOrgId && (orgsById.get(e.targetOrgId) ?? "").toLowerCase().includes(q)) ||
      JSON.stringify(e.metadata).toLowerCase().includes(q),
    );
  }, [entries, search, orgsById]);

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
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-black/60 dark:text-white/60" />
        <div>
          <div className="text-lg font-semibold">Admin audit log</div>
          <div className="text-sm text-black/50 dark:text-white/50">
            Every cross-tenant action taken by a platform admin.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, org or metadata…"
            className="pl-9"
            data-testid="input-search-audit"
          />
        </div>
        <Select value={orgId || ALL_ORGS} onValueChange={(v) => setOrgId(v === ALL_ORGS ? "" : v)}>
          <SelectTrigger className="w-full sm:w-56" data-testid="select-filter-org">
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ORGS}>All organizations</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action || ALL_ACTIONS} onValueChange={(v) => setAction(v === ALL_ACTIONS ? "" : v)}>
          <SelectTrigger className="w-full sm:w-56" data-testid="select-filter-action">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ACTIONS}>All actions</SelectItem>
            {ACTION_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Target org</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                  Failed to load audit log: {(error as Error)?.message ?? "Unknown error"}
                </td>
              </tr>
            )}
            {!isLoading && !isError && visible.map((e) => (
              <AuditRow key={e.id} entry={e} orgName={e.targetOrgId ? orgsById.get(e.targetOrgId) : undefined} />
            ))}
            {!isLoading && !isError && visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">
                  No audit entries match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditRow({ entry, orgName }: { entry: AdminAuditEntry; orgName?: string }) {
  return (
    <tr className="border-b border-black/5 align-top last:border-0 dark:border-white/10" data-testid={`row-audit-${entry.id}`}>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-black/60 dark:text-white/60">
        {formatDateTime(entry.createdAt)}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-xs dark:bg-white/10">
          {entry.action}
        </span>
      </td>
      <td className="px-4 py-3">
        {orgName ?? <span className="text-black/40">—</span>}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-black/60 dark:text-white/60">
        {entry.actorUserId.slice(0, 12)}…
      </td>
      <td className="max-w-md px-4 py-3 text-xs">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-black/60 dark:text-white/60">
          {JSON.stringify(entry.metadata, null, 0)}
        </pre>
      </td>
    </tr>
  );
}
