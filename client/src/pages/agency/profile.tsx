import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useCurrentOrganization } from "@/features/organization/api/use-organization-queries";
import { useUpdateOrganization } from "@/features/organization/api/use-organization-mutations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { PageLoading } from "@/features/organization/components/agency/PageLoading";
import { BrandColorPicker } from "@/features/organization/components/agency/BrandColorPicker";
import { LogoTile } from "@/features/organization/components/agency/LogoTile";
import { UK_COUNTIES } from "./utils/branding-options";
import type { OrganizationProfile, OrganizationSettings } from "@/features/organization/api/organization.api";

const CARD =
  "rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-white/[0.04] self-start";
const INPUT = "h-11 rounded-[6px] border-black/15 text-sm placeholder:text-xs placeholder:text-black/40";
const LABEL = "text-sm font-medium";
const HELP = "text-xs text-black/50 dark:text-white/50";

type ProfileForm = Required<OrganizationProfile>;

const EMPTY_PROFILE: ProfileForm = {
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  town: "",
  county: "",
  postcode: "",
};

function readProfile(settings: OrganizationSettings | undefined): ProfileForm {
  const p = settings?.profile ?? {};
  return {
    phone: p.phone ?? "",
    email: p.email ?? "",
    addressLine1: p.addressLine1 ?? "",
    addressLine2: p.addressLine2 ?? "",
    town: p.town ?? "",
    county: p.county ?? "",
    postcode: p.postcode ?? "",
  };
}

function CardTitle({ children }: { children: string }) {
  return <h2 className="mb-6 border-b border-black/10 pb-4 text-xl font-semibold dark:border-white/10">{children}</h2>;
}

export default function AgencyProfilePage() {
  const { can } = useRole();
  const { data: org, isLoading } = useCurrentOrganization();
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const allowed = can("admin", "branding");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setSlug(org.slug);
    setLogoUrl(org.logoUrl);
    setIconUrl(org.settings?.branding?.iconUrl ?? null);
    setBrandColor(org.brandColor ?? "#2563eb");
    setProfile(readProfile(org.settings));
  }, [org]);

  const setField = (key: keyof ProfileForm) => (value: string) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  const dirty = useMemo(() => {
    if (!org) return false;
    const saved = readProfile(org.settings);
    return (
      name !== org.name ||
      slug !== org.slug ||
      logoUrl !== (org.logoUrl ?? null) ||
      iconUrl !== (org.settings?.branding?.iconUrl ?? null) ||
      brandColor !== (org.brandColor ?? "#2563eb") ||
      (Object.keys(saved) as (keyof ProfileForm)[]).some((k) => saved[k] !== profile[k])
    );
  }, [org, name, slug, logoUrl, iconUrl, brandColor, profile]);

  const save = () => {
    if (!org) return;
    const existing = org.settings ?? {};
    // Only the sections this form edits; never echo untouched keys such as `onboarding`.
    const settings: OrganizationSettings = {
      profile: { ...existing.profile, ...profile },
      branding: { ...existing.branding, iconUrl },
    };
    updateOrg.mutate(
      { name: name.trim(), slug: slug.trim(), logoUrl, brandColor, settings },
      {
        onSuccess: () => toast({ title: "Saved", description: "Agency profile updated." }),
        onError: (err: Error) =>
          toast({ title: "Couldn't save", description: err?.message ?? "Something went wrong", variant: "destructive" }),
      },
    );
  };

  if (!allowed) return <OwnerOnlyGate />;
  if (isLoading) return <PageLoading />;

  const countyOptions =
    profile.county && !UK_COUNTIES.includes(profile.county) ? [profile.county, ...UK_COUNTIES] : UK_COUNTIES;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className={CARD}>
        <CardTitle>Business Profile & Branding</CardTitle>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="b-name" className={LABEL}>Agency Name</Label>
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${INPUT} w-full sm:w-[290px]`}
              data-testid="input-branding-name"
            />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-6">
            <div className="space-y-2">
              <Label htmlFor="b-phone" className={LABEL}>Main Contact Number</Label>
              <Input
                id="b-phone"
                value={profile.phone}
                onChange={(e) => setField("phone")(e.target.value)}
                className={`${INPUT} w-full sm:w-[290px]`}
                data-testid="input-profile-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-email" className={LABEL}>Email Address</Label>
              <Input
                id="b-email"
                type="email"
                value={profile.email}
                onChange={(e) => setField("email")(e.target.value)}
                className={`${INPUT} w-full sm:w-[360px]`}
                data-testid="input-profile-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className={LABEL}>Address</Label>
            <div className="space-y-3">
              <Input
                value={profile.addressLine1}
                onChange={(e) => setField("addressLine1")(e.target.value)}
                placeholder="AddressLine 1"
                aria-label="Address line 1"
                className={`${INPUT} w-full sm:w-[440px]`}
                data-testid="input-profile-address1"
              />
              <Input
                value={profile.addressLine2}
                onChange={(e) => setField("addressLine2")(e.target.value)}
                placeholder="Address Line 2"
                aria-label="Address line 2"
                className={`${INPUT} w-full sm:w-[440px]`}
                data-testid="input-profile-address2"
              />
              <Input
                value={profile.town}
                onChange={(e) => setField("town")(e.target.value)}
                placeholder="Town / City"
                aria-label="Town or city"
                className={`${INPUT} w-full sm:w-[290px]`}
                data-testid="input-profile-town"
              />
              <div className="flex flex-wrap gap-3">
                <Select value={profile.county || undefined} onValueChange={setField("county")}>
                  <SelectTrigger
                    aria-label="County"
                    className={`${INPUT} w-full sm:w-[290px] data-[placeholder]:text-xs data-[placeholder]:text-black/40`}
                    data-testid="select-profile-county"
                  >
                    <SelectValue placeholder="County" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countyOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={profile.postcode}
                  onChange={(e) => setField("postcode")(e.target.value)}
                  placeholder="Postcode"
                  aria-label="Postcode"
                  className={`${INPUT} w-full sm:w-[145px]`}
                  data-testid="input-profile-postcode"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="b-slug" className={LABEL}>Public URL</Label>
            <div className="flex h-11 w-full overflow-hidden rounded-[6px] border border-black/15 sm:w-[400px] dark:border-white/15">
              <span className="flex items-center whitespace-nowrap border-r border-black/15 px-3 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                travana.app/
              </span>
              <Input
                id="b-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="h-full min-w-0 flex-1 rounded-none border-0 focus-visible:ring-0 sm:w-[280px] sm:flex-none"
                data-testid="input-branding-slug"
              />
            </div>
            <div className="space-y-0.5">
              <p className={HELP}>This is the link to your direct login page, although you can just login at travana.app.</p>
              <p className={HELP}>Lowercase letters, numbers, hyphens only.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={!dirty || updateOrg.isPending}
              className="h-9 rounded-[6px] bg-[#2E3D50] px-3 text-xs font-semibold text-white hover:bg-[#25323F]"
              data-testid="button-save-branding"
            >
              {updateOrg.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <CardTitle>Branding</CardTitle>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <div className={LABEL}>Profile Logo</div>
              <p className={HELP}>Shown on your platform and all messages and quotes.</p>
            </div>
            <div className="flex flex-wrap items-start gap-6">
              <LogoTile
                value={logoUrl}
                onChange={setLogoUrl}
                label="profile logo"
                testId="branding-logo"
                className="h-[104px] w-[260px] max-w-full"
              />
              <LogoTile
                value={iconUrl}
                onChange={setIconUrl}
                label="icon logo"
                testId="branding-icon"
                className="h-[104px] w-[104px]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-0.5">
              <div className={LABEL}>Brand Colours</div>
              <p className={HELP}>Changes the colours of buttons, links and icons across the platform.</p>
            </div>
            <BrandColorPicker value={brandColor} onChange={setBrandColor} />
          </div>

          <div className="border-b border-black/10 dark:border-white/10" />
        </div>
      </div>
    </div>
  );
}
