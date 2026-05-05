import { useEffect, useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { useAgency } from "@/hooks/use-agency";
import {
  ALL_MODULES, MODULE_LABEL, ROLE_LABEL, VISIBLE_ROLES, ACCESS_LEVEL_LABEL,
  CUSTOMIZABLE_MODULES, DEFAULT_PERMISSIONS, loadOverrides, saveOverrides,
  type Overrides, type Module, type AccessLevel,
} from "@/lib/permissions";
import { AlertCircle, Lock, RotateCcw, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/components/command-center-shell";

const LEVEL_BADGE: Record<AccessLevel, string> = {
  none: "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50",
  read_own: "bg-amber-500/10 text-amber-700",
  read_all: "bg-blue-500/10 text-blue-700",
  write_own: "bg-purple-500/10 text-purple-700",
  write_all: "bg-emerald-500/10 text-emerald-700",
  admin: "bg-rose-500/10 text-rose-700",
};

export default function SettingsPermissionsPage() {
  const { role, setRole, can } = useRole();
  const { agency } = useAgency();
  const allowed = can("admin", "permissions");

  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides());
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setOverrides(loadOverrides()); }, []);

  const setLevel = (r: Role, m: Module, lvl: AccessLevel | null) => {
    setOverrides((prev) => {
      const next: Overrides = { ...prev, [r]: { ...(prev[r] || {}) } };
      if (lvl === null) delete next[r]![m];
      else next[r]![m] = lvl;
      return next;
    });
    setDirty(true);
  };

  const save = () => { saveOverrides(overrides); setDirty(false); };
  const reset = () => { setOverrides({}); saveOverrides({}); setDirty(false); };

  const getLevel = (r: Role, m: Module): AccessLevel =>
    (overrides[r]?.[m] ?? DEFAULT_PERMISSIONS[r]?.[m] ?? "none");

  return (
    <CommandCenterShell active="permissions-settings" title="Roles & Permissions" subtitle="Default matrix with light Owner toggles" role={role} onRoleChange={setRole}>
      {!allowed ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <div className="font-semibold">Owner access only</div>
          <div className="text-sm text-black/60 dark:text-white/60">Only the Agency Owner can edit role permissions.</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-700">
              <Shield className="mr-1.5 inline h-3.5 w-3.5" />
              Most rows are platform-locked. The unlocked rows are modules you can toggle for your agency.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} data-testid="button-reset-permissions"><RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset</Button>
              <Button size="sm" disabled={!dirty} onClick={save} style={{ background: agency.brandColor }} data-testid="button-save-permissions"><Save className="mr-1 h-3.5 w-3.5" /> Save changes</Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
            <table className="w-full text-sm">
              <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                <tr>
                  <th className="sticky left-0 bg-black/[0.02] px-4 py-3 text-left dark:bg-white/[0.02]">Module</th>
                  {VISIBLE_ROLES.map((r) => (
                    <th key={r} className="px-3 py-3 text-left">{ROLE_LABEL[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_MODULES.filter(m => m !== "platform_admin").map((m) => {
                  const editable = CUSTOMIZABLE_MODULES.includes(m);
                  return (
                    <tr key={m} className="border-b border-black/5 last:border-0 dark:border-white/10" data-testid={`row-perm-${m}`}>
                      <td className="sticky left-0 bg-white px-4 py-3 font-medium dark:bg-transparent">
                        <div className="flex items-center gap-2">
                          {!editable && <Lock className="h-3 w-3 text-black/30 dark:text-white/30" />}
                          {MODULE_LABEL[m]}
                        </div>
                      </td>
                      {VISIBLE_ROLES.map((r) => {
                        const lvl = getLevel(r, m);
                        const lockedRow = !editable || r === "Admin";
                        return (
                          <td key={r} className="px-3 py-3">
                            {lockedRow ? (
                              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", LEVEL_BADGE[lvl])} data-testid={`cell-perm-${r}-${m}`}>
                                {ACCESS_LEVEL_LABEL[lvl]}
                              </span>
                            ) : (
                              <select value={lvl} onChange={(e) => setLevel(r, m, e.target.value as AccessLevel)} className={cn("rounded-lg border border-black/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5", LEVEL_BADGE[lvl])} data-testid={`select-perm-${r}-${m}`}>
                                {(Object.keys(ACCESS_LEVEL_LABEL) as AccessLevel[]).map((opt) => (
                                  <option key={opt} value={opt}>{ACCESS_LEVEL_LABEL[opt]}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CommandCenterShell>
  );
}
