import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useCurrentOrganization } from "@/features/organization/api/use-organization-queries";
import { useUpdateOrganization } from "@/features/organization/api/use-organization-mutations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { PageLoading } from "@/features/organization/components/agency/PageLoading";
import { BrandColorPicker } from "@/features/organization/components/agency/BrandColorPicker";
import { LogoPicker } from "@/features/organization/components/agency/LogoPicker";
import { LiveBrandPreview } from "@/features/organization/components/agency/LiveBrandPreview";
import { SettingsField } from "@/features/organization/components/agency/SettingsField";
import { COMMON_TIMEZONES, CURRENCIES } from "./utils/branding-options";
import { SalesModeToggle } from "@/features/organization/components/agency/sales-mode-toggle";
import type { OrganizationSettings } from "@/features/organization/api/organization.api";

export default function AgencyProfilePage() {
  const { can } = useRole();
  const { data: org, isLoading } = useCurrentOrganization();
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const allowed = can("admin", "branding");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [timezone, setTimezone] = useState("Europe/London");
  const [currency, setCurrency] = useState("GBP");
  const [weekStart, setWeekStart] = useState<"sunday" | "monday">("monday");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setSlug(org.slug);
    setLogoUrl(org.logoUrl);
    setBrandColor(org.brandColor ?? "#2563eb");
    const s = org.settings ?? {};
    if (typeof s.timezone === "string") setTimezone(s.timezone);
    if (typeof s.currency === "string") setCurrency(s.currency);
    if (s.weekStart === "sunday" || s.weekStart === "monday") setWeekStart(s.weekStart);
  }, [org]);

  const dirty = useMemo(() => {
    if (!org) return false;
    const s = org.settings ?? {};
    return (
      name !== org.name ||
      slug !== org.slug ||
      logoUrl !== (org.logoUrl ?? null) ||
      brandColor !== (org.brandColor ?? "#2563eb") ||
      timezone !== (s.timezone ?? "Europe/London") ||
      currency !== (s.currency ?? "GBP") ||
      weekStart !== (s.weekStart ?? "monday")
    );
  }, [org, name, slug, logoUrl, brandColor, timezone, currency, weekStart]);

  const save = () => {
    if (!org) return;
    const settings: OrganizationSettings = { ...(org.settings ?? {}), timezone, currency, weekStart };
    updateOrg.mutate(
      { name: name.trim(), slug: slug.trim(), logoUrl, brandColor, settings },
      {
        onSuccess: () => toast({ title: "Saved", description: "Agency profile updated." }),
        onError: (err: any) =>
          toast({ title: "Couldn't save", description: err?.message ?? "Something went wrong", variant: "destructive" }),
      },
    );
  };

  if (!allowed) return <OwnerOnlyGate />;
  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <SalesModeToggle />
      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <div className="space-y-6 rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
          <SettingsField label="Agency name">
          <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-branding-name" />
        </SettingsField>

        <SettingsField label="Public URL">
          <div className="flex items-center overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
            <span className="px-3 text-xs text-black/55 dark:text-white/55 whitespace-nowrap">travelhub.app/</span>
            <Input
              id="b-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="border-0 rounded-none focus-visible:ring-0"
              data-testid="input-branding-slug"
            />
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">Lowercase letters, numbers, hyphens only.</div>
        </SettingsField>

        <SettingsField label="Logo">
          <LogoPicker value={logoUrl} onChange={setLogoUrl} />
        </SettingsField>

        <SettingsField label="Brand color">
          <BrandColorPicker value={brandColor} onChange={setBrandColor} />
        </SettingsField>

        <div className="grid gap-4 sm:grid-cols-3">
          <SettingsField label="Timezone">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              data-testid="select-org-timezone"
            >
              {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </SettingsField>
          <SettingsField label="Currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              data-testid="select-org-currency"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </SettingsField>
          <SettingsField label="Week starts on">
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value as "sunday" | "monday")}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              data-testid="select-org-week-start"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </SettingsField>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={!dirty || updateOrg.isPending}
            style={{ background: brandColor }}
            data-testid="button-save-branding"
          >
            {updateOrg.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {updateOrg.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

        <LiveBrandPreview name={name} slug={slug} logoUrl={logoUrl} brandColor={brandColor} />
      </div>
    </div>
  );
}
