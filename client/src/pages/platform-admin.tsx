import { useEffect, useMemo, useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { readAgencies, writeAgencies, useAgency, PLAN_DETAILS, type Agency } from "@/hooks/use-agency";
import { AlertCircle, Building2, Eye, ShieldOff, ShieldCheck, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const isOnTrial = (a: Agency) => {
  if (!a.trialEndsAt) return false;
  return new Date(a.trialEndsAt).getTime() > Date.now();
};

const trialDaysLeft = (a: Agency) => {
  if (!a.trialEndsAt) return null;
  const ms = new Date(a.trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
};

const seatsOf = (a: Agency) => a.seatsUsed ?? 0;

const monthlyRevenueOf = (a: Agency) => {
  if (a.status !== "active" || isOnTrial(a)) return 0;
  return PLAN_DETAILS[a.plan].pricePerMonth;
};

const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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

  const stats = useMemo(() => {
    const mrr = agencies.reduce((s, a) => s + monthlyRevenueOf(a), 0);
    const seatsUsed = agencies.reduce((s, a) => s + seatsOf(a), 0);
    const seatLimit = agencies.reduce((s, a) => s + a.seatLimit, 0);
    const paying = agencies.filter((a) => a.status === "active" && !isOnTrial(a)).length;
    const trial = agencies.filter((a) => a.status === "active" && isOnTrial(a)).length;
    const suspended = agencies.filter((a) => a.status === "suspended").length;
    return { mrr, seatsUsed, seatLimit, paying, trial, suspended };
  }, [agencies]);

  const visible = agencies.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase()) ||
    a.slug.toLowerCase().includes(filter.toLowerCase()) ||
    a.ownerEmail.toLowerCase().includes(filter.toLowerCase())
  );

  const exportCsv = () => {
    const header = ["Agency", "Slug", "Owner", "Email", "Plan", "Monthly £", "Seats used", "Seat limit", "Status", "Trial ends", "Created"];
    const rows = agencies.map((a) => [
      a.name,
      a.slug,
      a.ownerName,
      a.ownerEmail,
      PLAN_DETAILS[a.plan].label,
      monthlyRevenueOf(a),
      seatsOf(a),
      a.seatLimit,
      isOnTrial(a) ? "trial" : a.status,
      a.trialEndsAt ? new Date(a.trialEndsAt).toISOString().slice(0, 10) : "",
      a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `travelhub-billing-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="MRR" value={formatGBP(stats.mrr)} accent="ok" testId="stat-mrr" />
            <Stat label="Paying" value={String(stats.paying)} testId="stat-paying" />
            <Stat label="On trial" value={String(stats.trial)} accent="warn" testId="stat-trial" />
            <Stat label="Suspended" value={String(stats.suspended)} testId="stat-suspended" />
            <Stat label="Seats used" value={`${stats.seatsUsed} / ${stats.seatLimit}`} testId="stat-seats" />
            <Stat label="Total agencies" value={String(agencies.length)} testId="stat-total" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by name, slug or owner…" className="pl-9" data-testid="input-search-agencies" />
            </div>
            <Button onClick={exportCsv} variant="outline" className="gap-2" data-testid="button-export-csv">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
            <table className="w-full text-sm">
              <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Agency</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">MRR</th>
                  <th className="px-4 py-3 text-left">Seats</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const onTrial = isOnTrial(a);
                  const daysLeft = trialDaysLeft(a);
                  const used = seatsOf(a);
                  const overSeats = used > a.seatLimit;
                  return (
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
                      <td className="px-4 py-3" data-testid={`text-mrr-${a.id}`}>
                        {monthlyRevenueOf(a) === 0 ? <span className="text-black/40">—</span> : formatGBP(monthlyRevenueOf(a))}
                      </td>
                      <td className="px-4 py-3" data-testid={`text-seats-${a.id}`}>
                        <span className={cn(overSeats && "font-semibold text-amber-600")}>{used} / {a.seatLimit}</span>
                      </td>
                      <td className="px-4 py-3">
                        {a.status === "suspended" ? (
                          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">suspended</span>
                        ) : onTrial ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700" data-testid={`badge-trial-${a.id}`}>
                            trial · {daysLeft}d left
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">active</span>
                        )}
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
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-black/50 dark:text-white/50">No agencies match your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CommandCenterShell>
  );
}

function Stat({ label, value, accent, testId }: { label: string; value: string; accent?: "ok" | "warn"; testId?: string }) {
  return (
    <div className={cn("rounded-2xl border p-4", accent === "warn" ? "border-amber-500/30 bg-amber-500/5" : accent === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5")} data-testid={testId}>
      <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
