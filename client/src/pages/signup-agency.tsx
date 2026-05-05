import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Building2, Palette, CreditCard, User, Check, ChevronRight, ChevronLeft, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgency, readAgencies, writeAgencies, type AgencyPlan, PLAN_DETAILS } from "@/hooks/use-agency";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Agency", icon: Building2 },
  { id: 2, label: "Branding", icon: Palette },
  { id: 3, label: "Plan", icon: CreditCard },
  { id: 4, label: "Owner", icon: User },
];

const SUGGESTED_COLORS = ["#2563eb", "#0891b2", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#9333ea", "#db2777"];

export default function SignupAgencyPage() {
  const [, setLocation] = useLocation();
  const { switchAgency } = useAgency();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTaken, setSlugTaken] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#2563eb");

  const [plan, setPlan] = useState<AgencyPlan>("growth");

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleNameChange = (v: string) => {
    setName(v);
    const auto = v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSlug(auto);
    setSlugTaken(readAgencies().some((a) => a.slug === auto));
  };

  const handleSlugChange = (v: string) => {
    const cleaned = v.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(cleaned);
    setSlugTaken(readAgencies().some((a) => a.slug === cleaned));
  };

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setLogoUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canProceed = () => {
    if (step === 1) return !!name.trim() && !!slug.trim() && !slugTaken;
    if (step === 2) return !!brandColor;
    if (step === 3) return !!plan;
    if (step === 4) return !!ownerName.trim() && !!ownerEmail.trim() && password.length >= 6;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const planDetail = PLAN_DETAILS[plan];
    const newAgency = {
      id: `a-${Date.now()}`,
      name: name.trim(),
      slug,
      logoUrl,
      brandColor,
      plan,
      seatLimit: planDetail.seats,
      status: "active" as const,
      ownerEmail: ownerEmail.trim(),
      ownerName: ownerName.trim(),
      createdAt: new Date().toISOString(),
    };
    const all = readAgencies();
    writeAgencies([...all, newAgency]);
    switchAgency(newAgency);
    sessionStorage.setItem("apple-travel-role-preview", "Admin");
    try { window.dispatchEvent(new Event("role-preview-updated")); } catch {}
    await new Promise((r) => setTimeout(r, 700));
    setLocation("/welcome-team");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-black dark:to-slate-900 text-slate-900 dark:text-white">
      <nav className="border-b border-black/5 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-black/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold">TravelHub</span>
          </div>
          <button onClick={() => setLocation("/")} className="text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white" data-testid="link-back-to-login">
            Already have an account? Sign in
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight" data-testid="text-signup-title">Start your agency</h1>
          <p className="text-black/60 dark:text-white/60">Get your team up and running in under five minutes.</p>
        </div>

        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isComplete = step > s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <div className={cn("flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition", isActive ? "border-blue-500 bg-blue-500/10" : isComplete ? "border-emerald-500/50 bg-emerald-500/10" : "border-black/10 bg-white/50 dark:border-white/10 dark:bg-white/5")} data-testid={`step-indicator-${s.id}`}>
                  <div className={cn("grid h-7 w-7 place-items-center rounded-lg", isActive ? "bg-blue-500 text-white" : isComplete ? "bg-emerald-500 text-white" : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50")}>
                    {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn("text-xs font-medium", isActive ? "text-blue-700 dark:text-blue-300" : isComplete ? "text-emerald-700 dark:text-emerald-300" : "text-black/50 dark:text-white/50")}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Tell us about your agency</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">This is how your team and clients will see you.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agency-name">Agency name</Label>
                    <Input id="agency-name" data-testid="input-agency-name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Sunset Voyages" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agency-slug">Workspace URL</Label>
                    <div className="flex items-center overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                      <span className="bg-black/5 px-3 py-2 text-sm text-black/55 dark:bg-white/5 dark:text-white/55">travelhub.app/</span>
                      <input id="agency-slug" data-testid="input-agency-slug" value={slug} onChange={(e) => handleSlugChange(e.target.value)} placeholder="your-agency" className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    {slug && (
                      <div className={cn("text-xs", slugTaken ? "text-red-600" : "text-emerald-600")} data-testid="text-slug-status">
                        {slugTaken ? "That URL is already taken" : "Available"}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Make it yours</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">Your logo and brand color will appear across the app.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        {logoUrl ? <img src={logoUrl} alt="logo" className="h-full w-full object-cover" data-testid="img-logo-preview" /> : <Upload className="h-6 w-6 text-black/40" />}
                      </div>
                      <label className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10" data-testid="label-upload-logo">
                        {logoUrl ? "Replace logo" : "Upload logo"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} data-testid="input-logo-file" />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Brand color</Label>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setBrandColor(c)} className={cn("h-10 w-10 rounded-xl border-2 transition", brandColor === c ? "border-black/60 scale-110 dark:border-white" : "border-transparent hover:scale-105")} style={{ background: c }} data-testid={`button-color-${c}`} />
                      ))}
                      <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-xl border-2 border-transparent" data-testid="input-color-picker" />
                    </div>
                    <div className="mt-3 rounded-xl p-4 text-white" style={{ background: brandColor }} data-testid="preview-brand-color">
                      <div className="text-sm font-semibold">Preview — your sidebar accent</div>
                      <div className="text-xs opacity-80">{name || "Your agency"}</div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Pick your plan</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">You can change this anytime from billing.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(Object.keys(PLAN_DETAILS) as AgencyPlan[]).map((p) => {
                      const d = PLAN_DETAILS[p];
                      const selected = plan === p;
                      return (
                        <button key={p} type="button" onClick={() => setPlan(p)} className={cn("rounded-2xl border-2 p-4 text-left transition", selected ? "border-blue-500 bg-blue-500/5" : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20")} data-testid={`button-plan-${p}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold">{d.label}</span>
                            {selected && <Check className="h-4 w-4 text-blue-600" />}
                          </div>
                          <div className="mb-3"><span className="text-2xl font-bold">£{d.pricePerMonth}</span><span className="text-sm text-black/55 dark:text-white/55">/mo</span></div>
                          <ul className="space-y-1 text-xs text-black/65 dark:text-white/65">
                            {d.features.map((f) => <li key={f}>• {f}</li>)}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Create the owner account</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">You'll have full access to the agency.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="owner-name">Your full name</Label>
                      <Input id="owner-name" data-testid="input-owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-email">Email</Label>
                      <Input id="owner-email" data-testid="input-owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="owner-pw">Password</Label>
                      <Input id="owner-pw" data-testid="input-owner-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-blue-500/5 p-4 text-xs text-blue-700 dark:text-blue-300">
                    Your agency <strong>{name || "—"}</strong> on the <strong>{PLAN_DETAILS[plan].label}</strong> plan ({PLAN_DETAILS[plan].seats} seats).
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between border-t border-black/5 pt-6 dark:border-white/10">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} data-testid="button-prev-step">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} data-testid="button-next-step" style={{ background: brandColor }}>
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={!canProceed() || submitting} data-testid="button-create-agency" style={{ background: brandColor }}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create agency"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
