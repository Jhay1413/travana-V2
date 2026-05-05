import { useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { useAgency, useTeam, type TeamMember } from "@/hooks/use-agency";
import { ROLE_LABEL, VISIBLE_ROLES } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Plus, Trash2, Shield, Users, AlertCircle } from "lucide-react";
import type { Role } from "@/components/command-center-shell";
import { cn } from "@/lib/utils";

export default function SettingsTeamPage() {
  const { role, setRole, can } = useRole();
  const { agency } = useAgency();
  const { team, updateTeam } = useTeam();

  const allowed = can("admin", "team");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Agent");

  const seatsUsed = team.filter((m) => m.status !== "suspended").length;
  const atLimit = seatsUsed >= agency.seatLimit;

  const addInvite = () => {
    if (!inviteEmail.trim() || atLimit) return;
    const m: TeamMember = {
      id: `inv-${Date.now()}`,
      name: inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      status: "invited",
    };
    updateTeam([...team, m]);
    setInviteEmail("");
  };

  const changeRole = (id: string, r: Role) => updateTeam(team.map((m) => m.id === id ? { ...m, role: r } : m));
  const removeMember = (id: string) => updateTeam(team.filter((m) => m.id !== id));
  const toggleSuspend = (id: string) => updateTeam(team.map((m) => m.id === id ? { ...m, status: m.status === "suspended" ? "active" : "suspended" } : m));

  return (
    <CommandCenterShell active="team-settings" title="Team & Seats" subtitle="Manage your agency members" role={role} onRoleChange={setRole}>
      {!allowed ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <div className="font-semibold">Owner access only</div>
          <div className="text-sm text-black/60 dark:text-white/60">Only the Agency Owner can manage the team.</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard icon={<Users className="h-4 w-4" />} label="Active members" value={String(team.filter(m => m.status === "active").length)} />
            <StatCard icon={<Mail className="h-4 w-4" />} label="Pending invites" value={String(team.filter(m => m.status === "invited").length)} />
            <StatCard icon={<Shield className="h-4 w-4" />} label="Seats used" value={`${seatsUsed} / ${agency.seatLimit}`} accent={atLimit ? "warn" : "ok"} />
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-4 text-sm font-semibold">Invite a teammate</h3>
            {atLimit && (
              <div className="mb-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                You've reached your seat limit. Upgrade your plan to invite more.
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@company.com" disabled={atLimit} data-testid="input-invite-email" />
              </div>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} disabled={atLimit} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" data-testid="select-invite-role">
                {VISIBLE_ROLES.filter(r => r !== "Admin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <Button onClick={addInvite} disabled={atLimit || !inviteEmail.trim()} style={{ background: agency.brandColor }} data-testid="button-send-invite">
                <Plus className="mr-1 h-4 w-4" /> Invite
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
            <table className="w-full text-sm">
              <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-member-${m.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-black/50 dark:text-white/50">{m.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value as Role)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5" data-testid={`select-role-${m.id}`}>
                        {VISIBLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        m.status === "active" && "bg-emerald-500/10 text-emerald-700",
                        m.status === "invited" && "bg-blue-500/10 text-blue-700",
                        m.status === "suspended" && "bg-red-500/10 text-red-700")}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleSuspend(m.id)} className="mr-2 text-xs font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white" data-testid={`button-toggle-${m.id}`}>
                        {m.status === "suspended" ? "Reactivate" : "Suspend"}
                      </button>
                      <button onClick={() => removeMember(m.id)} className="text-xs font-medium text-red-600 hover:text-red-700" data-testid={`button-remove-${m.id}`}>
                        <Trash2 className="inline h-3.5 w-3.5" />
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "ok" | "warn" }) {
  return (
    <div className={cn("rounded-2xl border p-4", accent === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5")}>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
        {icon}<span>{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
