import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane, Building2, User, Clock, Users, Check, ChevronRight, ChevronLeft,
  Loader2, Plus, X, Phone, MapPin, Mail, Calendar, MapPinned,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import axiosClient from "@/api/client/axios-client";

const STEPS = [
  { id: 1, label: "Company", icon: Building2 },
  { id: 2, label: "Owner", icon: User },
  { id: 3, label: "Hours", icon: Clock },
  { id: 4, label: "Branches", icon: MapPinned },
  { id: 5, label: "Agents", icon: Users },
  { id: 6, label: "Review", icon: Check },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type OpeningPattern = "mon-fri" | "mon-sat" | "seven-days";

type DaySchedule = {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
};

type AgentRole = "Agent" | "Senior Agent" | "Manager" | "Admin";
type AgentStatus = "Active" | "Inactive";
type ContactRelationship = "Spouse" | "Parent" | "Sibling" | "Child" | "Friend" | "Other";

type Agent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: AgentRole;
  status: AgentStatus;
  branchIndex: number;
  contactName: string;
  contactRelationship: ContactRelationship;
  contactPhone: string;
};

type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  openingPattern: OpeningPattern;
  bankHolidaysOpen: boolean;
  schedule: DaySchedule[];
};

const AGENT_ROLE_OPTIONS: AgentRole[] = ["Agent", "Senior Agent", "Manager", "Admin"];
const CONTACT_RELATIONSHIP_OPTIONS: ContactRelationship[] = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function buildDefaultSchedule(pattern: OpeningPattern): DaySchedule[] {
  return DAYS.map((day, i) => {
    const isWeekday = i < 5;
    const isSat = i === 5;
    let open = false;
    if (pattern === "mon-fri") open = isWeekday;
    else if (pattern === "mon-sat") open = isWeekday || isSat;
    else open = true;
    return { day, open, openTime: "09:00", closeTime: "17:30" };
  });
}

const EMPTY_AGENT_FORM: Omit<Agent, "id"> = {
  name: "", email: "", phone: "", address: "",
  role: "Agent", status: "Active", branchIndex: 0,
  contactName: "", contactRelationship: "Spouse", contactPhone: "",
};

function makeBranch(name = ""): Branch {
  return {
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    address: "",
    phone: "",
    email: "",
    openingPattern: "mon-fri",
    bankHolidaysOpen: false,
    schedule: buildDefaultSchedule("mon-fri"),
  };
}

export default function SignupAgencyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Company Details (these populate the DEFAULT branch — index 0)
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  // Step 2: Owner/Admin Details
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");

  // Step 3: Default branch opening (pattern + bank holidays + hours)
  const [defaultPattern, setDefaultPattern] = useState<OpeningPattern>("mon-fri");
  const [defaultBankHolidaysOpen, setDefaultBankHolidaysOpen] = useState(false);
  const [defaultSchedule, setDefaultSchedule] = useState<DaySchedule[]>(() => buildDefaultSchedule("mon-fri"));

  // Step 4: Additional branches (default branch is implicit from steps 1+3)
  const [extraBranches, setExtraBranches] = useState<Branch[]>([]);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);

  // Step 5: Agents
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentForm, setAgentForm] = useState<Omit<Agent, "id">>(EMPTY_AGENT_FORM);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  const allBranches = useMemo<Branch[]>(() => {
    const def: Branch = {
      id: "default",
      name: companyName.trim() || "Main Branch",
      address,
      phone: companyPhone,
      email: companyEmail,
      openingPattern: defaultPattern,
      bankHolidaysOpen: defaultBankHolidaysOpen,
      schedule: defaultSchedule,
    };
    return [def, ...extraBranches];
  }, [companyName, address, companyPhone, companyEmail, defaultPattern, defaultBankHolidaysOpen, defaultSchedule, extraBranches]);

  const handleCompanyNameChange = (v: string) => {
    setCompanyName(v);
    setSlug(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleDefaultPatternChange = (pattern: OpeningPattern) => {
    setDefaultPattern(pattern);
    setDefaultSchedule(buildDefaultSchedule(pattern));
  };

  const updateDefaultDay = (idx: number, changes: Partial<DaySchedule>) => {
    setDefaultSchedule((prev) => prev.map((d, i) => i === idx ? { ...d, ...changes } : d));
  };

  const applyDefaultToAll = (idx: number) => {
    const { open, openTime, closeTime } = defaultSchedule[idx];
    setDefaultSchedule((prev) => prev.map((d) => ({ ...d, open, openTime, closeTime })));
  };

  // Extra branch helpers
  const addExtraBranch = () => {
    const branch = makeBranch(`Branch ${extraBranches.length + 2}`);
    setExtraBranches((prev) => [...prev, branch]);
    setEditingExtraId(branch.id);
  };
  const removeExtraBranch = (id: string) => {
    setExtraBranches((prev) => prev.filter((b) => b.id !== id));
    if (editingExtraId === id) setEditingExtraId(null);
    // remap any agents pointed at a removed branch back to default (0)
    setAgents((prev) => prev.map((a) => {
      const branchIds = ["default", ...extraBranches.filter((b) => b.id !== id).map((b) => b.id)];
      return a.branchIndex >= branchIds.length ? { ...a, branchIndex: 0 } : a;
    }));
  };
  const updateExtraBranch = (id: string, changes: Partial<Branch>) => {
    setExtraBranches((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const next = { ...b, ...changes };
      if (changes.openingPattern && changes.openingPattern !== b.openingPattern) {
        next.schedule = buildDefaultSchedule(changes.openingPattern);
      }
      return next;
    }));
  };
  const updateExtraDay = (branchId: string, dayIdx: number, changes: Partial<DaySchedule>) => {
    setExtraBranches((prev) => prev.map((b) =>
      b.id !== branchId ? b : { ...b, schedule: b.schedule.map((d, i) => i === dayIdx ? { ...d, ...changes } : d) }
    ));
  };

  // Agents
  const addOrUpdateAgent = () => {
    if (!agentForm.name.trim() || !agentForm.email.trim() || !isValidEmail(agentForm.email)) return;
    if (editingAgentId) {
      setAgents((prev) => prev.map((a) => a.id === editingAgentId ? { ...agentForm, id: editingAgentId } : a));
      setEditingAgentId(null);
    } else {
      setAgents((prev) => [...prev, { ...agentForm, id: `agent-${Date.now()}-${prev.length}` }]);
    }
    setAgentForm(EMPTY_AGENT_FORM);
  };
  const editAgent = (agent: Agent) => {
    setAgentForm({
      name: agent.name, email: agent.email, phone: agent.phone, address: agent.address,
      role: agent.role, status: agent.status, branchIndex: agent.branchIndex,
      contactName: agent.contactName, contactRelationship: agent.contactRelationship, contactPhone: agent.contactPhone,
    });
    setEditingAgentId(agent.id);
  };
  const removeAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    if (editingAgentId === id) {
      setEditingAgentId(null);
      setAgentForm(EMPTY_AGENT_FORM);
    }
  };

  const canProceed = () => {
    if (step === 1)
      return !!companyName.trim() && !!slug && !!address.trim() && !!companyPhone.trim()
        && !!companyEmail.trim() && isValidEmail(companyEmail);
    if (step === 2)
      return !!ownerName.trim() && !!ownerEmail.trim() && isValidEmail(ownerEmail)
        && !!ownerPhone.trim() && password.length >= 8;
    if (step === 4)
      return extraBranches.every((b) => !!b.name.trim() && !!b.address.trim() && !!b.phone.trim()
        && !!b.email.trim() && isValidEmail(b.email));
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const payload = {
      agencyName: companyName.trim(),
      slug,
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      ownerPhone: ownerPhone.trim(),
      password,
      branches: allBranches.map((b) => ({
        name: b.name.trim(),
        address: b.address.trim(),
        phone: b.phone.trim(),
        email: b.email.trim(),
        openingPattern: b.openingPattern,
        bankHolidaysOpen: b.bankHolidaysOpen,
        openingHours: b.schedule,
      })),
      agents: agents.map((a) => {
        const contactName = a.contactName.trim();
        const contactPhone = a.contactPhone.trim();
        const contactPerson = contactName || contactPhone
          ? { name: contactName, relationship: a.contactRelationship, phone: contactPhone }
          : undefined;
        return {
          name: a.name.trim(),
          email: a.email.trim(),
          phone: a.phone.trim(),
          address: a.address.trim(),
          role: a.role,
          active: a.status === "Active",
          branchIndex: a.branchIndex,
          contactPerson,
        };
      }),
    };

    try {
      await axiosClient.post("/api/v2/onboarding/signup", payload);
      toast({
        title: "Agency created",
        description: "We've sent a verification link to your owner email. Sign in once you've verified.",
      });
      setLocation("/");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Signup failed — please try again";
      toast({ title: "Signup failed", description: msg, variant: "destructive" });
      setSubmitting(false);
    }
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

        <div className="mb-8 flex items-center gap-1.5">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isComplete = step > s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <div className={cn("flex flex-1 items-center gap-1.5 rounded-xl border px-2 py-1.5 transition", isActive ? "border-blue-500 bg-blue-500/10" : isComplete ? "border-emerald-500/50 bg-emerald-500/10" : "border-black/10 bg-white/50 dark:border-white/10 dark:bg-white/5")} data-testid={`step-indicator-${s.id}`}>
                  <div className={cn("grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg", isActive ? "bg-blue-500 text-white" : isComplete ? "bg-emerald-500 text-white" : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50")}>
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className={cn("hidden text-xs font-medium sm:block", isActive ? "text-blue-700 dark:text-blue-300" : isComplete ? "text-emerald-700 dark:text-emerald-300" : "text-black/50 dark:text-white/50")}>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

              {/* ── Step 1: Company Details (= Default Branch) ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Company Details</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      Tell us about your travel agency. This becomes your default branch — you can add more later.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="company-name" data-testid="input-company-name" value={companyName} onChange={(e) => handleCompanyNameChange(e.target.value)} placeholder="e.g. Sunset Voyages" className="pl-9" />
                      </div>
                      {slug && (
                        <p className="text-xs text-black/50 dark:text-white/50">Your URL slug: <span className="font-mono">{slug}</span></p>
                      )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="company-address">Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="company-address" data-testid="input-company-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 High Street, London, EC1A 1BB" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="company-phone" data-testid="input-company-phone" type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+44 20 7123 4567" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="company-email" data-testid="input-company-email" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="hello@youragency.com" className="pl-9" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Owner/Admin Details ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Owner / Admin Details</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">The primary administrator for this account.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="owner-name">Owner / Admin Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="owner-name" data-testid="input-owner-name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Jane Smith" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="owner-email" data-testid="input-owner-email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="jane@youragency.com" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="owner-phone" data-testid="input-owner-phone" type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+44 7700 900000" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="owner-password">Password</Label>
                      <Input id="owner-password" data-testid="input-owner-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                      {password.length > 0 && password.length < 8 && (
                        <p className="text-xs text-red-600">Password must be at least 8 characters</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Default Branch — Opening Setup + Hours ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Default Branch — Opening Hours</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      Set when <span className="font-medium">{companyName.trim() || "your default branch"}</span> is open.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Opening Pattern</Label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        { value: "mon-fri" as OpeningPattern, label: "Monday to Friday", desc: "5-day week" },
                        { value: "mon-sat" as OpeningPattern, label: "Monday to Saturday", desc: "6-day week" },
                        { value: "seven-days" as OpeningPattern, label: "Open Seven Days", desc: "7-day week" },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleDefaultPatternChange(opt.value)}
                          className={cn("rounded-2xl border-2 p-4 text-left transition", defaultPattern === opt.value ? "border-blue-500 bg-blue-500/5" : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20")}
                          data-testid={`button-pattern-${opt.value}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-semibold">{opt.label}</span>
                            {defaultPattern === opt.value && <Check className="h-4 w-4 text-blue-600" />}
                          </div>
                          <span className="text-xs text-black/55 dark:text-white/55">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Bank Holidays</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { value: true, label: "Open Bank Holidays", desc: "Trade on UK bank holidays" },
                        { value: false, label: "Closed Bank Holidays", desc: "Closed on UK bank holidays" },
                      ]).map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setDefaultBankHolidaysOpen(opt.value)}
                          className={cn("rounded-2xl border-2 p-4 text-left transition", defaultBankHolidaysOpen === opt.value ? "border-blue-500 bg-blue-500/5" : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20")}
                          data-testid={`button-bankholiday-${opt.value ? "open" : "closed"}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-semibold">{opt.label}</span>
                            {defaultBankHolidaysOpen === opt.value && <Check className="h-4 w-4 text-blue-600" />}
                          </div>
                          <span className="text-xs text-black/55 dark:text-white/55">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <ScheduleTable
                    schedule={defaultSchedule}
                    onUpdateDay={updateDefaultDay}
                    onApplyToAll={applyDefaultToAll}
                    keyPrefix="default"
                  />
                </div>
              )}

              {/* ── Step 4: Additional Branches ── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Additional Branches</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      Optional. Your default branch ({companyName.trim() || "main"}) is already set up — add more locations here.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {extraBranches.map((branch, i) => {
                      const isOpen = editingExtraId === branch.id;
                      return (
                        <div key={branch.id} className="rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5" data-testid={`branch-card-${i}`}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                              <MapPinned className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{branch.name || `Branch ${i + 2}`}</div>
                              <div className="truncate text-xs text-black/50 dark:text-white/50">
                                {branch.address || "No address yet"}
                              </div>
                            </div>
                            <button type="button" onClick={() => setEditingExtraId(isOpen ? null : branch.id)} className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10" data-testid={`button-toggle-branch-${i}`}>
                              {isOpen ? "Done" : "Edit"}
                            </button>
                            <button type="button" onClick={() => removeExtraBranch(branch.id)} className="rounded-lg p-1.5 text-black/50 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10" data-testid={`button-remove-branch-${i}`} aria-label="Remove branch">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {isOpen && (
                            <div className="space-y-5 border-t border-black/10 px-4 py-5 dark:border-white/10">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label>Branch Name</Label>
                                  <Input value={branch.name} onChange={(e) => updateExtraBranch(branch.id, { name: e.target.value })} placeholder="e.g. Manchester Office" data-testid={`input-branch-name-${i}`} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Address</Label>
                                  <Input value={branch.address} onChange={(e) => updateExtraBranch(branch.id, { address: e.target.value })} placeholder="Branch address" data-testid={`input-branch-address-${i}`} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Phone</Label>
                                  <Input type="tel" value={branch.phone} onChange={(e) => updateExtraBranch(branch.id, { phone: e.target.value })} placeholder="Branch phone" data-testid={`input-branch-phone-${i}`} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Email</Label>
                                  <Input type="email" value={branch.email} onChange={(e) => updateExtraBranch(branch.id, { email: e.target.value })} placeholder="branch@youragency.com" data-testid={`input-branch-email-${i}`} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Opening Pattern</Label>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  {(["mon-fri", "mon-sat", "seven-days"] as OpeningPattern[]).map((p) => (
                                    <button key={p} type="button" onClick={() => updateExtraBranch(branch.id, { openingPattern: p })} className={cn("rounded-xl border-2 px-3 py-2 text-xs font-medium", branch.openingPattern === p ? "border-blue-500 bg-blue-500/5" : "border-black/10 dark:border-white/10")}>
                                      {p === "mon-fri" ? "Mon–Fri" : p === "mon-sat" ? "Mon–Sat" : "7 Days"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={branch.bankHolidaysOpen} onChange={(e) => updateExtraBranch(branch.id, { bankHolidaysOpen: e.target.checked })} className="h-4 w-4 accent-blue-500" />
                                Open on bank holidays
                              </label>
                              <ScheduleTable
                                schedule={branch.schedule}
                                onUpdateDay={(idx, c) => updateExtraDay(branch.id, idx, c)}
                                onApplyToAll={(idx) => {
                                  const { open, openTime, closeTime } = branch.schedule[idx];
                                  setExtraBranches((prev) => prev.map((b) =>
                                    b.id !== branch.id ? b : { ...b, schedule: b.schedule.map((d) => ({ ...d, open, openTime, closeTime })) }
                                  ));
                                }}
                                keyPrefix={`branch-${i}`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <Button type="button" variant="outline" onClick={addExtraBranch} data-testid="button-add-branch">
                      <Plus className="mr-1.5 h-4 w-4" /> Add another branch
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 5: Agents ── */}
              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Travel Agents</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">Add your team members. You can also do this later from Settings.</p>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/5">
                    <h3 className="text-sm font-semibold">{editingAgentId ? "Edit Agent" : "Add Agent"}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-name">Agent Name</Label>
                        <Input id="agent-name" data-testid="input-agent-name" value={agentForm.name} onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-email">Email Address</Label>
                        <Input id="agent-email" data-testid="input-agent-email" type="email" value={agentForm.email} onChange={(e) => setAgentForm((f) => ({ ...f, email: e.target.value }))} placeholder="john@youragency.com" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-phone">Phone Number</Label>
                        <Input id="agent-phone" data-testid="input-agent-phone" type="tel" value={agentForm.phone} onChange={(e) => setAgentForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+44 7700 900000" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="agent-address">Address</Label>
                        <Input id="agent-address" data-testid="input-agent-address" value={agentForm.address} onChange={(e) => setAgentForm((f) => ({ ...f, address: e.target.value }))} placeholder="221B Baker Street, London" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-role">Role</Label>
                        <select
                          id="agent-role"
                          value={agentForm.role}
                          onChange={(e) => setAgentForm((f) => ({ ...f, role: e.target.value as AgentRole }))}
                          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                          data-testid="select-agent-role"
                        >
                          {AGENT_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      {allBranches.length > 1 && (
                        <div className="space-y-1.5">
                          <Label htmlFor="agent-branch">Branch</Label>
                          <select
                            id="agent-branch"
                            value={agentForm.branchIndex}
                            onChange={(e) => setAgentForm((f) => ({ ...f, branchIndex: Number(e.target.value) }))}
                            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                            data-testid="select-agent-branch"
                          >
                            {allBranches.map((b, i) => <option key={b.id} value={i}>{b.name || `Branch ${i + 1}`}{i === 0 ? " (default)" : ""}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-status">Status</Label>
                        <select
                          id="agent-status"
                          value={agentForm.status}
                          onChange={(e) => setAgentForm((f) => ({ ...f, status: e.target.value as AgentStatus }))}
                          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                          data-testid="select-agent-status"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">Contact Person</h4>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="agent-contact-name">Name</Label>
                          <Input id="agent-contact-name" data-testid="input-agent-contact-name" value={agentForm.contactName} onChange={(e) => setAgentForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Jane Doe" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="agent-contact-relationship">Relationship</Label>
                          <select
                            id="agent-contact-relationship"
                            value={agentForm.contactRelationship}
                            onChange={(e) => setAgentForm((f) => ({ ...f, contactRelationship: e.target.value as ContactRelationship }))}
                            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                            data-testid="select-agent-contact-relationship"
                          >
                            {CONTACT_RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="agent-contact-phone">Phone</Label>
                          <Input id="agent-contact-phone" data-testid="input-agent-contact-phone" type="tel" value={agentForm.contactPhone} onChange={(e) => setAgentForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="+44 7700 900001" />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={addOrUpdateAgent}
                        disabled={!agentForm.name.trim() || !agentForm.email.trim() || !isValidEmail(agentForm.email)}
                        data-testid="button-add-agent"
                        className="bg-blue-500 text-white hover:bg-blue-600"
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        {editingAgentId ? "Update Agent" : "Add Agent"}
                      </Button>
                      {editingAgentId && (
                        <Button type="button" variant="ghost" onClick={() => { setEditingAgentId(null); setAgentForm(EMPTY_AGENT_FORM); }} data-testid="button-cancel-edit">
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {agents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50" data-testid="text-no-agents">
                      <Users className="mx-auto mb-2 h-5 w-5 opacity-60" />
                      No agents added yet — that's fine, you can add them anytime.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {agents.map((agent) => (
                        <div key={agent.id} className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5" data-testid={`row-agent-${agent.id}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{agent.name}</span>
                              <span className={cn("rounded-full px-1.5 py-0.5 text-xs", agent.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50")}>
                                {agent.status}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                              {agent.email}{agent.phone && ` · ${agent.phone}`} · {agent.role}
                              {allBranches.length > 1 && ` · ${allBranches[agent.branchIndex]?.name ?? "—"}`}
                            </div>
                          </div>
                          <button type="button" onClick={() => editAgent(agent)} className="rounded-lg p-1.5 text-black/50 transition hover:bg-black/5 hover:text-blue-600 dark:text-white/50 dark:hover:bg-white/10" data-testid={`button-edit-agent-${agent.id}`} aria-label="Edit agent">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button type="button" onClick={() => removeAgent(agent.id)} className="rounded-lg p-1.5 text-black/50 transition hover:bg-black/5 hover:text-red-600 dark:text-white/50 dark:hover:bg-white/10" data-testid={`button-remove-agent-${agent.id}`} aria-label="Remove agent">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 6: Review & Confirm ── */}
              {step === 6 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Review & Confirm</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">Check everything looks right before creating your agency.</p>
                  </div>

                  <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Owner / Admin</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-black/50 dark:text-white/50">Name</dt><dd className="font-medium">{ownerName || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Email</dt><dd className="font-medium">{ownerEmail || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Phone</dt><dd className="font-medium">{ownerPhone || "—"}</dd>
                    </dl>
                  </div>

                  {allBranches.map((b, i) => (
                    <div key={b.id} className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                      <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">
                        {i === 0 ? "Default Branch — " : "Branch — "}{b.name}
                      </h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <dt className="text-black/50 dark:text-white/50">Address</dt><dd className="font-medium">{b.address || "—"}</dd>
                        <dt className="text-black/50 dark:text-white/50">Phone</dt><dd className="font-medium">{b.phone || "—"}</dd>
                        <dt className="text-black/50 dark:text-white/50">Email</dt><dd className="font-medium">{b.email || "—"}</dd>
                        <dt className="text-black/50 dark:text-white/50">Pattern</dt>
                        <dd className="font-medium">
                          {b.openingPattern === "mon-fri" ? "Mon–Fri" : b.openingPattern === "mon-sat" ? "Mon–Sat" : "7 Days"}
                          {b.bankHolidaysOpen ? " · BH open" : " · BH closed"}
                        </dd>
                      </dl>
                      <div className="mt-3 space-y-1 border-t border-black/5 pt-3 dark:border-white/10">
                        {b.schedule.map((d) => (
                          <div key={d.day} className="flex justify-between text-xs">
                            <span className="text-black/60 dark:text-white/60">{d.day}</span>
                            {d.open ? <span className="font-medium">{d.openTime} – {d.closeTime}</span> : <span className="text-black/40">Closed</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Agents ({agents.length})</h3>
                    {agents.length === 0 ? (
                      <p className="text-sm text-black/40 dark:text-white/40">No agents added.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {agents.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{a.name}</span>
                            <span className="text-black/50 dark:text-white/50">{a.role} · {a.status}{allBranches.length > 1 ? ` · ${allBranches[a.branchIndex]?.name ?? "—"}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between border-t border-black/5 pt-6 dark:border-white/10">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || submitting} data-testid="button-prev-step">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < 6 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} data-testid="button-next-step" className="bg-blue-500 text-white hover:bg-blue-600">
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={submitting} data-testid="button-create-agency" className="bg-blue-500 text-white hover:bg-blue-600">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Agency"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ScheduleTable(props: {
  schedule: DaySchedule[];
  onUpdateDay: (idx: number, changes: Partial<DaySchedule>) => void;
  onApplyToAll: (idx: number) => void;
  keyPrefix: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="pb-3 text-left font-medium text-black/60 dark:text-white/60">Day</th>
            <th className="pb-3 text-center font-medium text-black/60 dark:text-white/60">Open</th>
            <th className="pb-3 pl-4 text-left font-medium text-black/60 dark:text-white/60">Opening</th>
            <th className="pb-3 pl-4 text-left font-medium text-black/60 dark:text-white/60">Closing</th>
            <th className="pb-3 text-center font-medium text-black/60 dark:text-white/60">Apply to all</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/5">
          {props.schedule.map((day, idx) => (
            <tr key={day.day}>
              <td className="py-3 pr-4 font-medium w-28">{day.day}</td>
              <td className="py-3 text-center">
                <input
                  type="checkbox"
                  checked={day.open}
                  onChange={(e) => props.onUpdateDay(idx, { open: e.target.checked })}
                  className="h-4 w-4 rounded border-black/20 accent-blue-500"
                  data-testid={`checkbox-open-${props.keyPrefix}-${day.day.toLowerCase()}`}
                />
              </td>
              <td className="py-3 pl-4">
                <input
                  type="time"
                  value={day.openTime}
                  onChange={(e) => props.onUpdateDay(idx, { openTime: e.target.value })}
                  disabled={!day.open}
                  className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-white/10"
                  data-testid={`input-open-time-${props.keyPrefix}-${day.day.toLowerCase()}`}
                />
              </td>
              <td className="py-3 pl-4">
                <input
                  type="time"
                  value={day.closeTime}
                  onChange={(e) => props.onUpdateDay(idx, { closeTime: e.target.value })}
                  disabled={!day.open}
                  className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-white/10"
                  data-testid={`input-close-time-${props.keyPrefix}-${day.day.toLowerCase()}`}
                />
              </td>
              <td className="py-3 text-center">
                <button
                  type="button"
                  onClick={() => props.onApplyToAll(idx)}
                  className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  data-testid={`button-apply-all-${props.keyPrefix}-${day.day.toLowerCase()}`}
                >
                  Apply
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
