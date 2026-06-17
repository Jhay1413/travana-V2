import { useState } from "react";
import { useLocation } from "wouter";
import { Building2, Mail, Plus, Trash2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgency, useTeam } from "@/hooks/use-agency";
import { ROLE_LABEL, VISIBLE_ROLES } from "@/lib/permissions";
import type { Role } from "@/types/auth/auth.types";

export default function WelcomeTeamPage() {
  const [, setLocation] = useLocation();
  const { agency } = useAgency();
  const { team, updateTeam } = useTeam();

  const [pending, setPending] = useState<{ email: string; role: Role }[]>([
    { email: "", role: "Agent" },
  ]);

  const addRow = () => setPending((p) => [...p, { email: "", role: "Agent" }]);
  const removeRow = (i: number) => setPending((p) => p.filter((_, idx) => idx !== i));

  const sendInvites = () => {
    const valid = pending.filter((p) => p.email.trim());
    const newMembers = valid.map((p, i) => ({
      id: `inv-${Date.now()}-${i}`,
      name: p.email.split("@")[0],
      email: p.email.trim(),
      role: p.role,
      status: "invited" as const,
    }));
    updateTeam([...team, ...newMembers] as typeof team);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-black dark:to-slate-900 text-slate-900 dark:text-white">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl text-white" style={{ background: agency.brandColor }}>
            {agency.logoUrl ? <img src={agency.logoUrl} alt="" className="h-full w-full rounded-3xl object-cover" /> : <Building2 className="h-8 w-8" />}
          </div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Agency created
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-welcome-title">Welcome to {agency.name}</h1>
          <p className="mt-2 text-black/60 dark:text-white/60">Invite your team to get started. You can do this later from settings.</p>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Invite teammates</h2>
            <span className="text-xs text-black/50 dark:text-white/50">{team.length} of {agency.seatLimit} seats used</span>
          </div>
          <div className="space-y-2">
            {pending.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-black/40" />
                <Input value={row.email} onChange={(e) => setPending((p) => p.map((r, idx) => idx === i ? { ...r, email: e.target.value } : r))} placeholder="teammate@yourcompany.com" data-testid={`input-invite-email-${i}`} />
                <select value={row.role} onChange={(e) => setPending((p) => p.map((r, idx) => idx === i ? { ...r, role: e.target.value as Role } : r))} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" data-testid={`select-invite-role-${i}`}>
                  {VISIBLE_ROLES.filter((r) => r !== "Admin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                {pending.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="grid h-9 w-9 place-items-center rounded-xl text-black/40 hover:bg-red-500/10 hover:text-red-600" data-testid={`button-remove-invite-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white" data-testid="button-add-invite-row">
            <Plus className="h-3.5 w-3.5" /> Add another
          </button>

          <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-4 dark:border-white/10">
            <Button variant="ghost" onClick={() => setLocation("/")} data-testid="button-skip-invites">Skip for now</Button>
            <Button onClick={sendInvites} style={{ background: agency.brandColor }} data-testid="button-send-invites">
              Send invites <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
