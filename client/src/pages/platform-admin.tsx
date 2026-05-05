import { useEffect, useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { readAgencies, writeAgencies, useAgency, PLAN_DETAILS, type Agency } from "@/hooks/use-agency";
import { AlertCircle, Building2, Eye, ShieldOff, ShieldCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function PlatformAdminPage() {
  const { role, setRole } = useRole();
  const { switchAgency } = useAgency();
  const allowed = role === "PlatformAdmin";

  const [agencies, setAgencies] = useState<Agency[]>(() => readAgencies());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const handler = () => setAgencies(readAgencies());
    window.addEventListener("agencies-updated", handler);
    return () => window.removeEventListener("agencies-updated", handler);
  }, []);

  const toggle = (id: string) => {
    const next = agencies.map((a) => a.id === id ? { ...a, status: a.status === "active" ? "suspended" as const : "active" as const } : a);
    writeAgencies(next);
    setAgencies(next);
  };

  const impersonate = (a: Agency) => {
    switchAgency(a);
    sessionStorage.setItem("apple-travel-role-preview", "Admin");
    sessionStorage.setItem("platform-impersonating", a.id);
    try { window.dispatchEvent(new Event("role-preview-updated")); } catch {}
    window.location.href = "/";
  };

  const visible = agencies.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.slug.toLowerCase().includes(filter.toLowerCase()) ||
    a.ownerEmail.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <CommandCenterShell active="platform-admin" title="Platform Admin" subtitle="All agencies on TravelHub" role={role} onRoleChange={setRole}>
      {!allowed ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <div className="font-semibold">Platform Admin only</div>
          <div className="text-sm text-black/60 dark:text-white/60">Switch to Platform Admin in the role selector to access this area.</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Total agencies" value={String(agencies.length)} />
            <Stat label="Active" value={String(agencies.filter(a => a.status === "active").length)} accent="ok" />
            <Stat label="Suspended" value={String(agencies.filter(a => a.status === "suspended").length)} accent="warn" />
            <Stat label="Total seats" value={String(agencies.reduce((s, a) => s + a.seatLimit, 0))} />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by name, slug or owner…" className="pl-9" data-testid="input-search-agencies" />
          </div>

          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
            <table className="w-full text-sm">
              <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Agency</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Seats</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-agency-${a.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: a.brandColor }}>
                          {a.logoUrl ? <img src={a.logoUrl} alt="" className="h-full w-full rounded-xl object-cover" /> : <Building2 className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-black/50 dark:text-white/50">/{a.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.ownerName}</div>
                      <div className="text-xs text-black/50 dark:text-white/50">{a.ownerEmail}</div>
                    </td>
                    <td className="px-4 py-3"><span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium dark:bg-white/10">{PLAN_DETAILS[a.plan].label}</span></td>
                    <td className="px-4 py-3">{a.seatLimit}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", a.status === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700")}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => impersonate(a)} className="mr-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline" data-testid={`button-impersonate-${a.id}`}>
                        <Eye className="h-3.5 w-3.5" /> View as
                      </button>
                      <button onClick={() => toggle(a.id)} className={cn("inline-flex items-center gap-1 text-xs font-medium hover:underline", a.status === "active" ? "text-red-600" : "text-emerald-600")} data-testid={`button-toggle-status-${a.id}`}>
                        {a.status === "active" ? <><ShieldOff className="h-3.5 w-3.5" /> Suspend</> : <><ShieldCheck className="h-3.5 w-3.5" /> Reactivate</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CommandCenterShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "ok" | "warn" }) {
  return (
    <div className={cn("rounded-2xl border p-4", accent === "warn" ? "border-amber-500/30 bg-amber-500/5" : accent === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5")}>
      <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
