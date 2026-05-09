import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane, Building2, User, Clock, Users, Check, ChevronRight, ChevronLeft,
  Loader2, Plus, X, Phone, MapPin, Mail, Calendar, Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgency, readAgencies, writeAgencies, writeTeam, type AgencyPlan, type TeamMember } from "@/hooks/use-agency";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Company", icon: Building2 },
  { id: 2, label: "Owner", icon: User },
  { id: 3, label: "Opening", icon: Calendar },
  { id: 4, label: "Hours", icon: Clock },
  { id: 5, label: "Agents", icon: Users },
  { id: 6, label: "Review", icon: Check },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type OpeningPattern = "mon-fri" | "mon-sat" | "seven-days";
type BankHolidayPref = "open" | "closed";

type DaySchedule = {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
};

type AgentRole = "Agent" | "Senior Agent" | "Manager" | "Admin";
type AgentStatus = "Active" | "Inactive";

type Agent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AgentRole;
  status: AgentStatus;
};

const AGENT_ROLE_OPTIONS: AgentRole[] = ["Agent", "Senior Agent", "Manager", "Admin"];
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
  name: "", email: "", phone: "", role: "Agent", status: "Active",
};

export default function SignupAgencyPage() {
  const [, setLocation] = useLocation();
  const { switchAgency } = useAgency();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Company Details
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

  // Step 3: Shop Opening Setup
  const [openingPattern, setOpeningPattern] = useState<OpeningPattern>("mon-fri");
  const [bankHolidays, setBankHolidays] = useState<BankHolidayPref>("closed");

  // Step 4: Opening Hours
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => buildDefaultSchedule("mon-fri"));

  // Step 5: Agents
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentForm, setAgentForm] = useState<Omit<Agent, "id">>(EMPTY_AGENT_FORM);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  const handleCompanyNameChange = (v: string) => {
    setCompanyName(v);
    setSlug(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleOpeningPatternChange = (pattern: OpeningPattern) => {
    setOpeningPattern(pattern);
    setSchedule(buildDefaultSchedule(pattern));
  };

  const updateDay = (idx: number, changes: Partial<DaySchedule>) => {
    setSchedule((prev) => prev.map((d, i) => i === idx ? { ...d, ...changes } : d));
  };

  const applyToAll = (idx: number) => {
    const { open, openTime, closeTime } = schedule[idx];
    setSchedule((prev) => prev.map((d) => ({ ...d, open, openTime, closeTime })));
  };

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
    setAgentForm({ name: agent.name, email: agent.email, phone: agent.phone, role: agent.role, status: agent.status });
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
    if (step === 1) return !!companyName.trim() && !!address.trim() && !!companyPhone.trim() && !!companyEmail.trim() && isValidEmail(companyEmail);
    if (step === 2) return !!ownerName.trim() && !!ownerEmail.trim() && isValidEmail(ownerEmail) && !!ownerPhone.trim() && password.length >= 8;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const newAgency = {
      id: `a-${Date.now()}`,
      name: companyName.trim(),
      slug,
      logoUrl: null,
      brandColor: "#2563eb",
      plan: "growth" as AgencyPlan,
      seatLimit: 15,
      seatsUsed: 1 + agents.length,
      trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: "active" as const,
      ownerEmail: ownerEmail.trim(),
      ownerName: ownerName.trim(),
      createdAt: new Date().toISOString(),
    };
    writeAgencies([...readAgencies(), newAgency]);
    switchAgency(newAgency);

    const ownerMember: TeamMember = {
      id: `u-${Date.now()}`,
      name: ownerName.trim(),
      email: ownerEmail.trim(),
      role: "Admin",
      status: "active",
    };
    const agentMembers: TeamMember[] = agents.map((agent, i) => ({
      id: `agent-${Date.now()}-${i}`,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      status: agent.status === "Active" ? "active" : "inactive",
    }));
    writeTeam([ownerMember, ...agentMembers]);

    localStorage.setItem(`onboarding-${newAgency.id}`, JSON.stringify({
      address, companyPhone, companyEmail, ownerPhone,
      openingPattern, bankHolidays, schedule,
    }));

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

              {/* ── Step 1: Company Details ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Company Details</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">Tell us about your travel agency.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
                        <Input id="company-name" data-testid="input-company-name" value={companyName} onChange={(e) => handleCompanyNameChange(e.target.value)} placeholder="e.g. Sunset Voyages" className="pl-9" />
                      </div>
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

              {/* ── Step 3: Shop Opening Setup ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Shop Opening Setup</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">Choose your typical working week and bank holiday preference.</p>
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
                          onClick={() => handleOpeningPatternChange(opt.value)}
                          className={cn("rounded-2xl border-2 p-4 text-left transition", openingPattern === opt.value ? "border-blue-500 bg-blue-500/5" : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20")}
                          data-testid={`button-pattern-${opt.value}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-semibold">{opt.label}</span>
                            {openingPattern === opt.value && <Check className="h-4 w-4 text-blue-600" />}
                          </div>
                          <span className="text-xs text-black/55 dark:text-white/55">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Bank Holiday Preference</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { value: "open" as BankHolidayPref, label: "Open Bank Holidays", desc: "Trade on UK bank holidays" },
                        { value: "closed" as BankHolidayPref, label: "Closed Bank Holidays", desc: "Closed on UK bank holidays" },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBankHolidays(opt.value)}
                          className={cn("rounded-2xl border-2 p-4 text-left transition", bankHolidays === opt.value ? "border-blue-500 bg-blue-500/5" : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20")}
                          data-testid={`button-bankholiday-${opt.value}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-semibold">{opt.label}</span>
                            {bankHolidays === opt.value && <Check className="h-4 w-4 text-blue-600" />}
                          </div>
                          <span className="text-xs text-black/55 dark:text-white/55">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Opening Hours ── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold">Opening Hours</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">Set your opening and closing times for each day.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-black/10 dark:border-white/10">
                          <th className="pb-3 text-left font-medium text-black/60 dark:text-white/60">Day</th>
                          <th className="pb-3 text-center font-medium text-black/60 dark:text-white/60">Open</th>
                          <th className="pb-3 pl-4 text-left font-medium text-black/60 dark:text-white/60">Opening Time</th>
                          <th className="pb-3 pl-4 text-left font-medium text-black/60 dark:text-white/60">Closing Time</th>
                          <th className="pb-3 text-center font-medium text-black/60 dark:text-white/60">Apply to all</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {schedule.map((day, idx) => (
                          <tr key={day.day}>
                            <td className="py-3 pr-4 font-medium w-28">{day.day}</td>
                            <td className="py-3 text-center">
                              <input
                                type="checkbox"
                                checked={day.open}
                                onChange={(e) => updateDay(idx, { open: e.target.checked })}
                                className="h-4 w-4 rounded border-black/20 accent-blue-500"
                                data-testid={`checkbox-open-${day.day.toLowerCase()}`}
                              />
                            </td>
                            <td className="py-3 pl-4">
                              <input
                                type="time"
                                value={day.openTime}
                                onChange={(e) => updateDay(idx, { openTime: e.target.value })}
                                disabled={!day.open}
                                className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-white/10"
                                data-testid={`input-open-time-${day.day.toLowerCase()}`}
                              />
                            </td>
                            <td className="py-3 pl-4">
                              <input
                                type="time"
                                value={day.closeTime}
                                onChange={(e) => updateDay(idx, { closeTime: e.target.value })}
                                disabled={!day.open}
                                className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm disabled:opacity-40 dark:border-white/10"
                                data-testid={`input-close-time-${day.day.toLowerCase()}`}
                              />
                            </td>
                            <td className="py-3 text-center">
                              <button
                                type="button"
                                onClick={() => applyToAll(idx)}
                                className="rounded-lg border border-black/10 px-2 py-1 text-xs font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                                data-testid={`button-apply-all-${day.day.toLowerCase()}`}
                              >
                                Apply
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => { setEditingAgentId(null); setAgentForm(EMPTY_AGENT_FORM); }}
                          data-testid="button-cancel-edit"
                        >
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
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Company Details</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-black/50 dark:text-white/50">Name</dt><dd className="font-medium">{companyName || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Address</dt><dd className="font-medium">{address || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Phone</dt><dd className="font-medium">{companyPhone || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Email</dt><dd className="font-medium">{companyEmail || "—"}</dd>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Owner / Admin Details</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-black/50 dark:text-white/50">Name</dt><dd className="font-medium">{ownerName || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Email</dt><dd className="font-medium">{ownerEmail || "—"}</dd>
                      <dt className="text-black/50 dark:text-white/50">Phone</dt><dd className="font-medium">{ownerPhone || "—"}</dd>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Opening Setup</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-black/50 dark:text-white/50">Pattern</dt>
                      <dd className="font-medium">
                        {openingPattern === "mon-fri" ? "Monday to Friday" : openingPattern === "mon-sat" ? "Monday to Saturday" : "Open Seven Days"}
                      </dd>
                      <dt className="text-black/50 dark:text-white/50">Bank Holidays</dt>
                      <dd className="font-medium">{bankHolidays === "open" ? "Open" : "Closed"}</dd>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Opening Hours</h3>
                    <div className="space-y-1.5">
                      {schedule.map((day) => (
                        <div key={day.day} className="flex items-center justify-between text-sm">
                          <span className="w-24 text-black/60 dark:text-white/60">{day.day}</span>
                          {day.open
                            ? <span className="font-medium">{day.openTime} – {day.closeTime}</span>
                            : <span className="text-black/40 dark:text-white/40">Closed</span>
                          }
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                    <h3 className="mb-3 text-sm font-semibold text-black/80 dark:text-white/80">Agents ({agents.length})</h3>
                    {agents.length === 0 ? (
                      <p className="text-sm text-black/40 dark:text-white/40">No agents added.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {agents.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{a.name}</span>
                            <span className="text-black/50 dark:text-white/50">{a.role} · {a.status}</span>
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
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} data-testid="button-prev-step">
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
