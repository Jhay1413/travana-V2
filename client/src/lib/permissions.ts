import type { Role } from "@/components/command-center-shell";

export type Module =
  | "clients"
  | "quotes"
  | "bookings"
  | "enquiries"
  | "pipeline"
  | "tickets"
  | "hr"
  | "sms"
  | "social"
  | "destination_guru"
  | "financials"
  | "referrals"
  | "team"
  | "billing"
  | "branding"
  | "permissions"
  | "audit"
  | "platform_admin";

export type AccessLevel = "none" | "read_own" | "read_all" | "write_own" | "write_all" | "admin";

export type PermissionMatrix = Record<Role, Partial<Record<Module, AccessLevel>>>;

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  PlatformAdmin: {
    clients: "admin", quotes: "admin", bookings: "admin", enquiries: "admin",
    pipeline: "admin", tickets: "admin", hr: "admin", sms: "admin", social: "admin",
    destination_guru: "admin", financials: "admin", referrals: "admin",
    team: "admin", billing: "admin", branding: "admin", permissions: "admin",
    audit: "admin", platform_admin: "admin",
  },
  Admin: {
    clients: "admin", quotes: "admin", bookings: "admin", enquiries: "admin",
    pipeline: "admin", tickets: "admin", hr: "admin", sms: "admin", social: "admin",
    destination_guru: "admin", financials: "admin", referrals: "admin",
    team: "admin", billing: "admin", branding: "admin", permissions: "admin",
    audit: "admin", platform_admin: "none",
  },
  Manager: {
    clients: "write_all", quotes: "write_all", bookings: "write_all", enquiries: "write_all",
    pipeline: "write_all", tickets: "write_all", hr: "read_all", sms: "write_all", social: "write_all",
    destination_guru: "write_all", financials: "read_all", referrals: "write_all",
    team: "read_all", billing: "none", branding: "none", permissions: "none",
    audit: "read_all", platform_admin: "none",
  },
  Agent: {
    clients: "write_own", quotes: "write_own", bookings: "write_own", enquiries: "write_own",
    pipeline: "write_all", tickets: "write_own", hr: "read_own", sms: "write_own", social: "write_own",
    destination_guru: "write_all", financials: "read_own", referrals: "read_own",
    team: "read_own", billing: "none", branding: "none", permissions: "none",
    audit: "none", platform_admin: "none",
  },
  Homeworker: {
    clients: "write_own", quotes: "write_own", bookings: "write_own", enquiries: "write_own",
    pipeline: "read_own", tickets: "write_own", hr: "read_own", sms: "write_own", social: "read_own",
    destination_guru: "write_all", financials: "read_own", referrals: "none",
    team: "read_own", billing: "none", branding: "none", permissions: "none",
    audit: "none", platform_admin: "none",
  },
  Referer: {
    referrals: "write_own",
    clients: "read_own",
    quotes: "none", bookings: "none", enquiries: "none", pipeline: "none",
    tickets: "none", hr: "none", sms: "none", social: "none", destination_guru: "none",
    financials: "read_own", team: "none", billing: "none", branding: "none",
    permissions: "none", audit: "none", platform_admin: "none",
  },
};

export const ROLE_LABEL: Record<Role, string> = {
  PlatformAdmin: "Platform Admin",
  Admin: "Agency Owner",
  Manager: "Manager",
  Agent: "Agent",
  Homeworker: "Homeworker",
  Referer: "Referral Agent",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  PlatformAdmin: "Manages all agencies on the platform",
  Admin: "Owns the agency. Full access including billing & branding",
  Manager: "Runs day-to-day operations across all agents",
  Agent: "Sells and manages their own assigned clients",
  Homeworker: "Independent agent — sees only their own clients",
  Referer: "Submits referrals and tracks commission",
};

const ALL_ROLES: Role[] = ["PlatformAdmin", "Admin", "Manager", "Agent", "Homeworker", "Referer"];
export const VISIBLE_ROLES: Role[] = ["Admin", "Manager", "Agent", "Homeworker", "Referer"];
export const ALL_MODULES: Module[] = [
  "clients", "quotes", "bookings", "enquiries", "pipeline", "tickets",
  "hr", "sms", "social", "destination_guru", "financials", "referrals",
  "team", "billing", "branding", "permissions", "audit", "platform_admin",
];

export const MODULE_LABEL: Record<Module, string> = {
  clients: "Clients", quotes: "Quotes", bookings: "Bookings", enquiries: "Enquiries",
  pipeline: "Pipeline", tickets: "Tickets", hr: "HR", sms: "SMS Center",
  social: "Social Posts", destination_guru: "Destination Guru", financials: "Financials",
  referrals: "Referrals", team: "Team Management", billing: "Billing & Plans",
  branding: "White-label Branding", permissions: "Roles & Permissions", audit: "Audit Log",
  platform_admin: "Platform Admin",
};

export const CUSTOMIZABLE_MODULES: Module[] = [
  "sms", "social", "destination_guru", "referrals", "tickets", "financials", "hr",
];

const OVERRIDES_KEY = "agency-permission-overrides";

export type Overrides = Partial<Record<Role, Partial<Record<Module, AccessLevel>>>>;

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveOverrides(o: Overrides) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)); } catch {}
  try { window.dispatchEvent(new Event("permissions-updated")); } catch {}
}

export function getEffectivePermission(role: Role, mod: Module, overrides?: Overrides): AccessLevel {
  const o = overrides ?? loadOverrides();
  const overridden = o[role]?.[mod];
  if (overridden) return overridden;
  return DEFAULT_PERMISSIONS[role]?.[mod] ?? "none";
}

export type Action = "view" | "edit" | "delete" | "admin";

export function can(
  role: Role,
  action: Action,
  mod: Module,
  scope: "own" | "any" = "any",
  overrides?: Overrides
): boolean {
  const lvl = getEffectivePermission(role, mod, overrides);
  if (lvl === "none") return false;
  if (lvl === "admin") return true;

  if (action === "admin") return lvl === "admin";

  if (action === "view") {
    if (lvl === "read_own" || lvl === "write_own") return scope === "own";
    return true;
  }
  if (action === "edit" || action === "delete") {
    if (lvl === "read_own" || lvl === "read_all") return false;
    if (lvl === "write_own") return scope === "own";
    return true;
  }
  return false;
}

export function canAccessModule(role: Role, mod: Module, overrides?: Overrides): boolean {
  return getEffectivePermission(role, mod, overrides) !== "none";
}

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  none: "No access",
  read_own: "View own only",
  read_all: "View all",
  write_own: "Edit own only",
  write_all: "Edit all",
  admin: "Full admin",
};

export { ALL_ROLES };
