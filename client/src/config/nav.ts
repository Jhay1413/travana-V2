import {
  Activity,
  Briefcase,
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Forward,
  HeartHandshake,
  LayoutGrid,
  LifeBuoy,
  Link2,
  ListChecks,
  MessageCircle,
  MessageSquare,
  Plane,
  Settings2,
  Share2,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Type,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OrgRole } from "@/types/auth/auth.types";

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  id: string;
  label?: string;
  icon?: LucideIcon;
  items: NavItem[];
};

export type NavConfig = NavSection[];

const AGENT_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/agent-overview", label: "Overview", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy },
      { path: "/chat", label: "Live Chat", icon: MessageSquare },
      { path: "/social-posts", label: "Social Posts", icon: Share2 },
      { path: "/destination-guru", label: "Destination Guru", icon: Sparkles },
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/opportunities", label: "Opportunities", icon: Target },
      { path: "/my-profile", label: "My Profile", icon: UserCircle },
    ],
  },
];

const BRANCH_MANAGER_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/branch-overview", label: "Dashboard", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy },
      { path: "/chat", label: "Live Chat", icon: MessageSquare },
      { path: "/sms-center", label: "Text", icon: MessageCircle },
      { path: "/destination-guru", label: "Destination Guru", icon: Sparkles },
      { path: "/opportunities", label: "Opportunities", icon: Target },
      { path: "/branch/targets", label: "Targets", icon: Target },
      { path: "/hr", label: "HR", icon: HeartHandshake },
      { path: "/hr-v2", label: "HR V2", icon: HeartHandshake },
    ],
  },
];

const ORG_ADMIN_NAV: NavConfig = [
  {
    id: "overview",
    items: [
      { path: "/agency/overview", label: "Overview", icon: LayoutGrid },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    icon: Building2,
    items: [
      { path: "/agency/profile", label: "Profile & Branding", icon: Sparkles },
      { path: "/agency/team", label: "Teams & Roles", icon: Users },
      { path: "/agency/branches", label: "Branches", icon: Building2 },
      { path: "/hr", label: "HR", icon: HeartHandshake },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: TrendingUp,
    items: [
      { path: "/agency/targets", label: "Targets", icon: Target },
      { path: "/agency/forwards", label: "Forwards", icon: Forward },
      { path: "/agency/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    id: "account-info",
    label: "Account Info",
    icon: CircleDollarSign,
    items: [
      { path: "/agency/billing", label: "Billing", icon: CircleDollarSign },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    items: [
      { path: "/agency/tour-operators", label: "Tour Operators", icon: Plane },
      { path: "/agency/templates", label: "Templates", icon: FileText },
      { path: "/agency/texts", label: "Texts", icon: Type },
      { path: "/agency/audit", label: "Audit Log", icon: Activity },
    ],
  },
];

const PLATFORM_ADMIN_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/platform-admin", label: "Dashboard", icon: LayoutGrid },
      { path: "/platform-admin/organizations", label: "All Agencies", icon: Building2 },
      { path: "/platform-admin/users", label: "All Users", icon: Users },
      { path: "/platform-admin/audit-log", label: "Audit Log", icon: Activity },
    ],
  },
];

const REFERRAL_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/referral-hub", label: "Affiliate Hub", icon: Link2 },
    ],
  },
];

export const NAV_BY_ROLE: Record<OrgRole, NavConfig> = {
  agent: AGENT_NAV,
  homeworker: AGENT_NAV,
  branch_manager: BRANCH_MANAGER_NAV,
  org_admin: ORG_ADMIN_NAV,
  platform_admin: PLATFORM_ADMIN_NAV,
  referral_agent: REFERRAL_NAV,
};

export function getNavForRole(orgRole: OrgRole | null | undefined): NavConfig {
  if (!orgRole) return AGENT_NAV;
  return NAV_BY_ROLE[orgRole] ?? AGENT_NAV;
}

// Ranking mirrors the server-side ROLE_RANK in user-org-roles.service.ts so
// the higher-power role's nav sections appear first when multiple roles merge.
const ROLE_RANK: Record<OrgRole, number> = {
  platform_admin: 120,
  org_admin:      100,
  branch_manager:  80,
  agent:           60,
  homeworker:      40,
  referral_agent:  20,
};

const ROLE_GROUP_META: Record<OrgRole, { label: string; icon: LucideIcon }> = {
  platform_admin: { label: "Platform",  icon: Activity },
  org_admin:      { label: "Admin",     icon: Shield },
  branch_manager: { label: "Branch",    icon: Briefcase },
  agent:          { label: "Agent",     icon: TrendingUp },
  homeworker:     { label: "Homeworker", icon: TrendingUp },
  referral_agent: { label: "Affiliate", icon: Link2 },
};

/**
 * Build the sidebar for a user's roles.
 *
 * - Single role: returns that role's nav as-is (existing layout preserved).
 * - Multiple roles: each role becomes ONE top-level collapsible group
 *   (e.g. "Admin", "Agent") containing every item from that role's nav,
 *   flattened from any sub-sections. Each group is self-contained — items
 *   are NOT deduped across groups, so e.g. an agent who is also a branch
 *   manager still sees Pipeline/Tickets/etc. under the Agent dropdown.
 */
export function getNavForRoles(roles: OrgRole[] | null | undefined): NavConfig {
  if (!roles || roles.length === 0) return AGENT_NAV;
  if (roles.length === 1) return getNavForRole(roles[0]);

  const ordered = roles.slice().sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0));
  const result: NavSection[] = [];

  for (const role of ordered) {
    const cfg = NAV_BY_ROLE[role] ?? [];
    const items: NavItem[] = cfg.flatMap((section) => section.items);
    if (items.length === 0) continue;

    const meta = ROLE_GROUP_META[role];
    result.push({
      id:    `role-${role}`,
      label: meta.label,
      icon:  meta.icon,
      items,
    });
  }

  return result;
}
