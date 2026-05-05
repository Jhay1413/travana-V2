import { useEffect, useState, useCallback } from "react";

export type AgencyPlan = "starter" | "growth" | "scale";

export type Agency = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
  plan: AgencyPlan;
  seatLimit: number;
  status: "active" | "suspended";
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Agent" | "Homeworker" | "Referer";
  status: "active" | "invited" | "suspended";
};

const AGENCY_KEY = "saas-current-agency";
const AGENCIES_KEY = "saas-agencies";
const TEAM_KEY = "saas-team";

export const PLAN_DETAILS: Record<AgencyPlan, { label: string; seats: number; pricePerMonth: number; features: string[] }> = {
  starter: { label: "Starter", seats: 5, pricePerMonth: 49, features: ["Up to 5 seats", "Core CRM", "Email support"] },
  growth: { label: "Growth", seats: 15, pricePerMonth: 149, features: ["Up to 15 seats", "Pipeline + Social", "Priority support"] },
  scale: { label: "Scale", seats: 50, pricePerMonth: 399, features: ["Up to 50 seats", "All modules", "Dedicated CSM"] },
};

const DEFAULT_AGENCY: Agency = {
  id: "demo-agency",
  name: "Tina's Travel Co.",
  slug: "tinas-travel",
  logoUrl: null,
  brandColor: "#2563eb",
  plan: "growth",
  seatLimit: 15,
  status: "active",
  ownerEmail: "tina@tinastravel.com",
  ownerName: "Tina Cooper",
  createdAt: new Date().toISOString(),
};

const DEFAULT_TEAM: TeamMember[] = [
  { id: "u1", name: "Tina Cooper", email: "tina@tinastravel.com", role: "Admin", status: "active" },
  { id: "u2", name: "Marcus Webb", email: "marcus@tinastravel.com", role: "Manager", status: "active" },
  { id: "u3", name: "Lila Frost", email: "lila@tinastravel.com", role: "Agent", status: "active" },
  { id: "u4", name: "Sophie Hart", email: "sophie@tinastravel.com", role: "Agent", status: "active" },
  { id: "u5", name: "Tom Reeve", email: "tom@independent.com", role: "Homeworker", status: "active" },
  { id: "u6", name: "Asha Patel", email: "asha@gmail.com", role: "Referer", status: "active" },
  { id: "u7", name: "Jordan Pine", email: "jordan@tinastravel.com", role: "Agent", status: "invited" },
];

const DEMO_AGENCIES: Agency[] = [
  DEFAULT_AGENCY,
  { id: "a2", name: "Sunset Voyages", slug: "sunset-voyages", logoUrl: null, brandColor: "#ea580c", plan: "starter", seatLimit: 5, status: "active", ownerEmail: "owner@sunset.com", ownerName: "Riya Khan", createdAt: new Date().toISOString() },
  { id: "a3", name: "Highland Holidays", slug: "highland-holidays", logoUrl: null, brandColor: "#16a34a", plan: "scale", seatLimit: 50, status: "active", ownerEmail: "ceo@highland.co.uk", ownerName: "Greg McLeod", createdAt: new Date().toISOString() },
  { id: "a4", name: "Coastal Escapes", slug: "coastal-escapes", logoUrl: null, brandColor: "#9333ea", plan: "growth", seatLimit: 15, status: "suspended", ownerEmail: "hello@coastal.com", ownerName: "Mira Holt", createdAt: new Date().toISOString() },
];

function readAgency(): Agency {
  try {
    const raw = localStorage.getItem(AGENCY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(AGENCY_KEY, JSON.stringify(DEFAULT_AGENCY));
  return DEFAULT_AGENCY;
}

export function readAgencies(): Agency[] {
  try {
    const raw = localStorage.getItem(AGENCIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(AGENCIES_KEY, JSON.stringify(DEMO_AGENCIES));
  return DEMO_AGENCIES;
}

export function writeAgencies(list: Agency[]) {
  localStorage.setItem(AGENCIES_KEY, JSON.stringify(list));
  try { window.dispatchEvent(new Event("agencies-updated")); } catch {}
}

export function readTeam(): TeamMember[] {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(TEAM_KEY, JSON.stringify(DEFAULT_TEAM));
  return DEFAULT_TEAM;
}

export function writeTeam(list: TeamMember[]) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(list));
  try { window.dispatchEvent(new Event("team-updated")); } catch {}
}

export function useAgency() {
  const [agency, setAgencyState] = useState<Agency>(() => readAgency());

  useEffect(() => {
    const handler = () => setAgencyState(readAgency());
    window.addEventListener("agency-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("agency-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const updateAgency = useCallback((patch: Partial<Agency>) => {
    setAgencyState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(AGENCY_KEY, JSON.stringify(next));
      try { window.dispatchEvent(new Event("agency-updated")); } catch {}
      return next;
    });
  }, []);

  const switchAgency = useCallback((a: Agency) => {
    setAgencyState(a);
    localStorage.setItem(AGENCY_KEY, JSON.stringify(a));
    try { window.dispatchEvent(new Event("agency-updated")); } catch {}
  }, []);

  return { agency, updateAgency, switchAgency };
}

export function useTeam() {
  const [team, setTeamState] = useState<TeamMember[]>(() => readTeam());
  useEffect(() => {
    const handler = () => setTeamState(readTeam());
    window.addEventListener("team-updated", handler);
    return () => window.removeEventListener("team-updated", handler);
  }, []);
  const updateTeam = useCallback((next: TeamMember[]) => {
    writeTeam(next);
    setTeamState(next);
  }, []);
  return { team, updateTeam };
}
