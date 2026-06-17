import { useState } from "react";
import { useRole } from "@/hooks/use-role";
import { useAgency } from "@/hooks/use-agency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Plus, Wallet, CheckCircle2, Clock, Banknote, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Referral = {
  id: string;
  clientName: string;
  status: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED";
  commission: number;
  submittedAt: string;
};

const SEED: Referral[] = [
  { id: "r1", clientName: "Marie K.", status: "PAID", commission: 75, submittedAt: "2026-04-12" },
  { id: "r2", clientName: "John P.", status: "IN_WALLET", commission: 110, submittedAt: "2026-04-22" },
  { id: "r3", clientName: "Sara D.", status: "PENDING", commission: 0, submittedAt: "2026-05-01" },
];

const STATUS = {
  PENDING: { label: "Pending", color: "bg-amber-500/10 text-amber-700", icon: Clock },
  IN_WALLET: { label: "In wallet", color: "bg-emerald-500/10 text-emerald-700", icon: Wallet },
  PAID: { label: "Paid", color: "bg-blue-500/10 text-blue-700", icon: CheckCircle2 },
  VOIDED: { label: "Voided", color: "bg-black/5 text-black/50", icon: Clock },
};

export default function ReferralAgentDashboard() {
  const { role } = useRole();
  const { agency } = useAgency();

  const [referrals, setReferrals] = useState<Referral[]>(SEED);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    setReferrals((r) => [
      { id: `r${Date.now()}`, clientName: name.trim(), status: "PENDING", commission: 0, submittedAt: new Date().toISOString().slice(0, 10) },
      ...r,
    ]);
    setName(""); setPhone(""); setNotes(""); setShowForm(false);
  };

  const totalEarned = referrals.filter(r => r.status === "PAID" || r.status === "IN_WALLET").reduce((s, r) => s + r.commission, 0);
  const inWallet = referrals.filter(r => r.status === "IN_WALLET").reduce((s, r) => s + r.commission, 0);
  const paid = referrals.filter(r => r.status === "PAID").reduce((s, r) => s + r.commission, 0);

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Users className="h-4 w-4" />} label="Referrals" value={String(referrals.length)} />
          <Stat icon={<Wallet className="h-4 w-4" />} label="In wallet" value={`£${inWallet}`} accent={agency.brandColor} />
          <Stat icon={<Banknote className="h-4 w-4" />} label="Paid out" value={`£${paid}`} />
          <Stat icon={<Gift className="h-4 w-4" />} label="Total earned" value={`£${totalEarned}`} />
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Submit a referral</h3>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)} style={{ background: agency.brandColor }} data-testid="button-show-referral-form">
                <Plus className="mr-1 h-4 w-4" /> New referral
              </Button>
            )}
          </div>
          {showForm && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ref-name">Client name</Label>
                  <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Jones" data-testid="input-referral-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ref-phone">Phone</Label>
                  <Input id="ref-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" data-testid="input-referral-phone" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-notes">Notes (destination, dates, party size)</Label>
                <textarea id="ref-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20 w-full rounded-xl border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/5" data-testid="input-referral-notes" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowForm(false)} data-testid="button-cancel-referral">Cancel</Button>
                <Button onClick={submit} style={{ background: agency.brandColor }} data-testid="button-submit-referral">Submit referral</Button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
          <div className="border-b border-black/5 bg-black/[0.02] px-4 py-3 text-sm font-semibold dark:border-white/10 dark:bg-white/[0.02]">Your referrals</div>
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="px-4 py-2 text-left">Client</th>
                <th className="px-4 py-2 text-left">Submitted</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => {
                const s = STATUS[r.status];
                const Icon = s.icon;
                return (
                  <tr key={r.id} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-referral-${r.id}`}>
                    <td className="px-4 py-3 font-medium">{r.clientName}</td>
                    <td className="px-4 py-3 text-black/55 dark:text-white/55">{r.submittedAt}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", s.color)}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{r.commission > 0 ? `£${r.commission}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-700">
          As a referral agent you only see your own referrals and basic client names. Full client details remain with the agency.
        </div>
      </div>
    </>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
        {icon}<span>{label}</span>
      </div>
      <div className="text-2xl font-semibold" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}
