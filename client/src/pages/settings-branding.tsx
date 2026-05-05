import { useState } from "react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { useAgency } from "@/hooks/use-agency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Building2, Upload, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED = ["#2563eb", "#0891b2", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#9333ea", "#db2777"];

export default function SettingsBrandingPage() {
  const { role, setRole, can } = useRole();
  const { agency, updateAgency } = useAgency();
  const allowed = can("admin", "branding");

  const [name, setName] = useState(agency.name);
  const [logoUrl, setLogoUrl] = useState<string | null>(agency.logoUrl);
  const [brandColor, setBrandColor] = useState(agency.brandColor);
  const [saved, setSaved] = useState(false);

  const handleLogo = (file: File) => {
    const r = new FileReader();
    r.onload = (e) => setLogoUrl(e.target?.result as string);
    r.readAsDataURL(file);
  };

  const save = () => {
    updateAgency({ name, logoUrl, brandColor });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <CommandCenterShell active="branding-settings" title="White-label Branding" subtitle="How your agency looks across the app" role={role} onRoleChange={setRole}>
      {!allowed ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <div className="font-semibold">Owner access only</div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="space-y-6 rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <div className="space-y-2">
              <Label htmlFor="b-name">Agency name</Label>
              <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-branding-name" />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" data-testid="img-branding-logo" /> : <Building2 className="h-6 w-6 text-black/40" />}
                </div>
                <label className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                  <Upload className="mr-1 inline h-3.5 w-3.5" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])} data-testid="input-branding-logo-file" />
                </label>
                {logoUrl && <button onClick={() => setLogoUrl(null)} className="text-xs text-red-600 hover:underline" data-testid="button-remove-logo">Remove</button>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Brand color</Label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((c) => (
                  <button key={c} type="button" onClick={() => setBrandColor(c)} className={cn("h-10 w-10 rounded-xl border-2 transition", brandColor === c ? "border-black/60 scale-110 dark:border-white" : "border-transparent hover:scale-105")} style={{ background: c }} data-testid={`button-branding-color-${c}`} />
                ))}
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-xl border-2 border-transparent" data-testid="input-branding-color" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} style={{ background: brandColor }} data-testid="button-save-branding">
                <Save className="mr-1 h-4 w-4" /> {saved ? "Saved!" : "Save changes"}
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Live preview</div>
            <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <div className="mb-4 flex items-center gap-3 rounded-xl p-3 text-white" style={{ background: brandColor }}>
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white/20">
                  {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-sm font-semibold">{name}</div>
                  <div className="text-xs opacity-80">Pipeline</div>
                </div>
              </div>
              <div className="space-y-2 text-xs text-black/60 dark:text-white/60">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: brandColor }} /> Active client</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: brandColor }} /> Won quote</div>
                <button className="mt-2 rounded-xl px-3 py-1.5 text-xs font-medium text-white" style={{ background: brandColor }}>Primary button</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CommandCenterShell>
  );
}
