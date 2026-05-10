import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentOrganization, useOrgMembers, organizationKeys } from "./queries/use-organization-queries";
import { useUpdateOrganization } from "./mutations/use-organization-mutations";
import type { Organization, OrgMember, OrganizationUpdate } from "@/api/endpoints/organization.api";

export type AgencyPlan = "starter" | "growth" | "scale";

export type Agency = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
  plan: AgencyPlan;
  seatLimit: number;
  seatsUsed?: number;
  trialEndsAt?: string | null;
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

const AGENCIES_KEY = "saas-agencies";

export const PLAN_DETAILS: Record<AgencyPlan, { label: string; seats: number; pricePerMonth: number; features: string[] }> = {
  starter: { label: "Starter", seats: 5, pricePerMonth: 49, features: ["Up to 5 seats", "Core CRM", "Email support"] },
  growth:  { label: "Growth",  seats: 15, pricePerMonth: 149, features: ["Up to 15 seats", "Pipeline + Social", "Priority support"] },
  scale:   { label: "Scale",   seats: 50, pricePerMonth: 399, features: ["Up to 50 seats", "All modules", "Dedicated CSM"] },
};

const FALLBACK_AGENCY: Agency = {
  id: "",
  name: "Your agency",
  slug: "",
  logoUrl: null,
  brandColor: "#2563eb",
  plan: "starter",
  seatLimit: 0,
  seatsUsed: 0,
  trialEndsAt: null,
  status: "active",
  ownerEmail: "",
  ownerName: "",
  createdAt: new Date().toISOString(),
};

function planFromOrg(org: Organization | undefined): AgencyPlan {
  if (org?.plan === "growth") return "growth";
  if (org?.plan === "enterprise") return "scale";
  return "starter";
}

function statusFromOrg(org: Organization | undefined): "active" | "suspended" {
  return org?.isActive === false ? "suspended" : "active";
}

function adaptOrg(org: Organization | undefined, members: OrgMember[] | undefined): Agency {
  if (!org) return FALLBACK_AGENCY;
  const owner = members?.find((m) => (m.user.orgRole ?? "") === "org_admin");
  const seatsUsed = members?.filter((m) => !m.user.banned).length ?? 0;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    brandColor: org.brandColor ?? "#2563eb",
    plan: planFromOrg(org),
    seatLimit: org.seatLimit ?? PLAN_DETAILS[planFromOrg(org)].seats,
    seatsUsed,
    trialEndsAt: org.trialEndsAt,
    status: statusFromOrg(org),
    ownerEmail: owner?.user.email ?? "",
    ownerName: owner?.user.name ?? "",
    createdAt: org.createdAt,
  };
}

function memberRole(orgRole: string | null | undefined): TeamMember["role"] {
  switch (orgRole) {
    case "org_admin":      return "Admin";
    case "branch_manager": return "Manager";
    case "homeworker":     return "Homeworker";
    case "referral_agent": return "Referer";
    default:               return "Agent";
  }
}

function memberStatus(m: OrgMember): TeamMember["status"] {
  if (m.user.banned) return "suspended";
  if (!m.user.emailVerified) return "invited";
  if (m.branches.length === 0) return "active";
  const anyActive = m.branches.some((b) => b.isActive);
  return anyActive ? "active" : "suspended";
}

export function adaptMembers(list: OrgMember[] | undefined): TeamMember[] {
  if (!list) return [];
  return list.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: memberRole(m.user.orgRole),
    status: memberStatus(m),
  }));
}

export function useAgency() {
  const { data: org } = useCurrentOrganization();
  const { data: members } = useOrgMembers({ enabled: false });
  const updateMutation = useUpdateOrganization();
  const qc = useQueryClient();

  const agency = useMemo(() => adaptOrg(org, members), [org, members]);

  const updateAgency = useCallback(
    (patch: Partial<Agency>) => {
      const apiPatch: OrganizationUpdate = {};
      if (patch.name !== undefined) apiPatch.name = patch.name;
      if (patch.brandColor !== undefined) apiPatch.brandColor = patch.brandColor;
      if (patch.logoUrl !== undefined) apiPatch.logoUrl = patch.logoUrl;
      if (patch.seatLimit !== undefined) apiPatch.seatLimit = patch.seatLimit;
      if (patch.slug !== undefined) apiPatch.slug = patch.slug;
      if (Object.keys(apiPatch).length === 0) return;
      updateMutation.mutate(apiPatch, {
        onSuccess: () => qc.invalidateQueries({ queryKey: organizationKeys.current() }),
      });
    },
    [updateMutation, qc],
  );

  const switchAgency = useCallback((_a: Agency) => {
    // Real impersonation is server-side and not yet implemented.
    // Kept for backward compatibility with platform-admin page.
  }, []);

  return { agency, updateAgency, switchAgency };
}

export function useTeam() {
  const { data: members } = useOrgMembers();
  const team = useMemo(() => adaptMembers(members), [members]);
  const updateTeam = useCallback((_next: TeamMember[]) => {
    // Mutations are now handled directly via useUpdateMemberRole / useSetMemberSuspended.
    // This shim is kept so legacy callers don't crash; they should migrate.
  }, []);
  return { team, updateTeam };
}

// ── Platform-admin (unchanged: still local mock list of all agencies) ─────────
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

const DEMO_AGENCIES: Agency[] = [
  { id: "a1", name: "Tina's Travel Co.", slug: "tinas-travel", logoUrl: null, brandColor: "#2563eb", plan: "growth", seatLimit: 15, seatsUsed: 7, trialEndsAt: null, status: "active", ownerEmail: "tina@tinastravel.com", ownerName: "Tina Cooper", createdAt: new Date().toISOString() },
  { id: "a2", name: "Sunset Voyages", slug: "sunset-voyages", logoUrl: null, brandColor: "#ea580c", plan: "starter", seatLimit: 5, seatsUsed: 3, trialEndsAt: daysFromNow(9), status: "active", ownerEmail: "owner@sunset.com", ownerName: "Riya Khan", createdAt: new Date().toISOString() },
  { id: "a3", name: "Highland Holidays", slug: "highland-holidays", logoUrl: null, brandColor: "#16a34a", plan: "scale", seatLimit: 50, seatsUsed: 38, trialEndsAt: null, status: "active", ownerEmail: "ceo@highland.co.uk", ownerName: "Greg McLeod", createdAt: new Date().toISOString() },
  { id: "a4", name: "Coastal Escapes", slug: "coastal-escapes", logoUrl: null, brandColor: "#9333ea", plan: "growth", seatLimit: 15, seatsUsed: 11, trialEndsAt: null, status: "suspended", ownerEmail: "hello@coastal.com", ownerName: "Mira Holt", createdAt: new Date().toISOString() },
];

export function readAgencies(): Agency[] {
  try {
    const raw = localStorage.getItem(AGENCIES_KEY);
    if (raw) return JSON.parse(raw) as Agency[];
  } catch {}
  localStorage.setItem(AGENCIES_KEY, JSON.stringify(DEMO_AGENCIES));
  return DEMO_AGENCIES;
}

export function writeAgencies(list: Agency[]) {
  localStorage.setItem(AGENCIES_KEY, JSON.stringify(list));
  try { window.dispatchEvent(new Event("agencies-updated")); } catch {}
}

// Legacy local-storage helpers preserved as no-ops so older imports don't break
// once tree-shaken consumers are migrated, these can be deleted.
export function readTeam(): TeamMember[] { return []; }
export function writeTeam(_list: TeamMember[]) {}
