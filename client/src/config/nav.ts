import {
  Activity,
  Anchor,
  BedDouble,
  Briefcase,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileText,
  Forward,
  Globe,
  HeartHandshake,
  Hotel,
  LayoutGrid,
  LifeBuoy,
  Link2,
  ListChecks,
  Map,
  MapPin,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  Plane,
  Settings2,
  Share2,
  Shield,
  Ship,
  Sparkles,
  Tag,
  Target,
  Tent,
  Trash2,
  TrendingUp,
  Trophy,
  Type,
  UserCircle,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { OrgRole } from "@/types/auth/auth.types";

// Keys for dynamic count badges rendered next to a nav item. The sidebar
// resolves each key to a live count (see app-sidenav.tsx).
export type NavBadgeKey = "tickets";

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadgeKey;
};

export type NavSection = {
  id: string;
  label?: string;
  icon?: LucideIcon;
  items: Array<NavItem | NavSection>;
};

export type NavConfig = NavSection[];

export function isNavItem(entry: NavItem | NavSection): entry is NavItem {
  return "path" in entry;
}

const AGENT_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/agent-overview", label: "Agent Dashboard", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/social-posts", label: "Social Posts", icon: Share2 },
      { path: "/social-wall", label: "Social Wall", icon: Newspaper },
      { path: "/destination-guru", label: "Destination Guru", icon: Sparkles },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy, badge: "tickets" },
      { path: "/chat", label: "Live Chat", icon: MessageSquare },
      { path: "/opportunities", label: "Opportunities", icon: Target },
    ],
  },
];

const BRANCH_MANAGER_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/branch-overview", label: "Dashboard", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy, badge: "tickets" },
      { path: "/chat", label: "Live Chat", icon: MessageSquare },
      { path: "/sms-center", label: "Text", icon: MessageCircle },
      { path: "/social-wall", label: "Social Wall", icon: Newspaper },
      { path: "/destination-guru", label: "Destination Guru", icon: Sparkles },
      { path: "/opportunities", label: "Opportunities", icon: Target },
      { path: "/branch/targets", label: "Targets", icon: Target },
      { path: "/hr", label: "HR", icon: HeartHandshake },
      { path: "/hr-v2", label: "HR V2", icon: HeartHandshake },
    ],
  },
];

// Platform-wide reference data (global catalog shared across all agencies),
// grouped under one "Data Management" dropdown. Each link renders the generic
// lookup CRUD page (/settings/:tableSlug). Shared by platform_admin and
// org_admin navs so both stay in sync.
const DATA_MANAGEMENT_SECTION: NavSection = {
  id: "data-management",
  label: "Data Management",
  icon: Database,
  items: [
    {
      id: "catalog-destinations",
      label: "Destinations",
      icon: Globe,
      items: [
        { path: "/settings/countries", label: "Countries", icon: Globe },
        { path: "/settings/destinations", label: "Destinations", icon: Map },
        { path: "/settings/resorts", label: "Resorts", icon: MapPin },
        { path: "/settings/airports", label: "Airports", icon: Plane },
      ],
    },
    {
      id: "catalog-accommodation",
      label: "Accommodation",
      icon: Hotel,
      items: [
        { path: "/settings/accommodation-list", label: "Accommodations", icon: Hotel },
        { path: "/settings/accommodation-types", label: "Accommodation Types", icon: BedDouble },
        { path: "/settings/board-basis", label: "Board Basis", icon: Package },
        { path: "/settings/room-types", label: "Room Types", icon: BedDouble },
        { path: "/settings/package-types", label: "Package Types", icon: Package },
      ],
    },
    {
      id: "catalog-parks",
      label: "Parks & Lodges",
      icon: Tent,
      items: [
        { path: "/settings/parks", label: "Parks", icon: Tent },
        { path: "/settings/lodges", label: "Lodges", icon: Tent },
        { path: "/settings/cottages", label: "Cottages", icon: Hotel },
      ],
    },
    {
      id: "catalog-cruise",
      label: "Cruise",
      icon: Ship,
      items: [
        { path: "/settings/cruise-lines", label: "Cruise Lines", icon: Ship },
        { path: "/settings/cruise-ships", label: "Cruise Ships", icon: Anchor },
        { path: "/settings/cruise-itineraries", label: "Cruise Itineraries", icon: Map },
        { path: "/settings/cruise-voyages", label: "Cruise Voyages", icon: Waves },
        { path: "/settings/cruise-extras", label: "Cruise Extras", icon: Package },
      ],
    },
    {
      id: "catalog-other",
      label: "Other Data",
      icon: Settings2,
      items: [
        { path: "/settings/tour-operators", label: "Tour Operators", icon: Plane },
        { path: "/settings/tags", label: "Tags", icon: Tag },
        { path: "/settings/deletion-codes", label: "Deletion Codes", icon: Trash2 },
      ],
    },
  ],
};

const ORG_ADMIN_NAV: NavConfig = [
  {
    id: "overview",
    items: [
      { path: "/agency/overview", label: "Admin Dashboard", icon: LayoutGrid },
      { path: "/social-wall", label: "Social Wall", icon: Newspaper },
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
      { path: "/agency/leaderboard", label: "Leader Board", icon: Trophy },
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
      { path: "/agency/templates", label: "Templates", icon: FileText },
      { path: "/agency/texts", label: "Texts", icon: Type },
      { path: "/agency/audit", label: "Audit Log", icon: Activity },
    ],
  },
  DATA_MANAGEMENT_SECTION,
];

const PLATFORM_ADMIN_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/platform-admin", label: "Dashboard", icon: LayoutGrid },
      { path: "/social-wall", label: "Social Wall", icon: Newspaper },
      { path: "/platform-admin/organizations", label: "All Agencies", icon: Building2 },
      { path: "/platform-admin/users", label: "All Users", icon: Users },
      { path: "/platform-admin/audit-log", label: "Audit Log", icon: Activity },
    ],
  },
  DATA_MANAGEMENT_SECTION,
];

const REFERRAL_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/referral-hub", label: "Affiliate Hub", icon: Link2 },
    ],
  },
];

const SOCIAL_MEDIA_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/agent-overview", label: "Dashboard", icon: LayoutGrid },
      { path: "/social-posts", label: "Social Posts", icon: Share2 },
      { path: "/social-wall", label: "Social Wall", icon: Newspaper },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/my-profile", label: "My Profile", icon: UserCircle },
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
  social_media_manager: SOCIAL_MEDIA_NAV,
};

export function getNavForRole(orgRole: OrgRole | null | undefined): NavConfig {
  if (!orgRole) return AGENT_NAV;
  return NAV_BY_ROLE[orgRole] ?? AGENT_NAV;
}

// Ranking mirrors the server-side ROLE_RANK in user-org-roles.service.ts so
// the higher-power role's nav sections appear first when multiple roles merge.
const ROLE_RANK: Record<OrgRole, number> = {
  platform_admin:       120,
  org_admin:            100,
  branch_manager:        80,
  agent:                 60,
  social_media_manager:  50,
  homeworker:            40,
  referral_agent:        20,
};

const ROLE_GROUP_META: Record<OrgRole, { label: string; icon: LucideIcon }> = {
  platform_admin:       { label: "Platform",  icon: Activity },
  org_admin:            { label: "Admin",     icon: Shield },
  branch_manager:       { label: "Branch",    icon: Briefcase },
  agent:                { label: "Agent",     icon: TrendingUp },
  social_media_manager: { label: "Social",    icon: Share2 },
  homeworker:           { label: "Homeworker", icon: TrendingUp },
  referral_agent:       { label: "Affiliate", icon: Link2 },
};

/**
 * Build the sidebar for a user's roles.
 *
 * - Single role: returns that role's nav as-is (existing layout preserved).
 * - Multiple roles: each role becomes ONE top-level collapsible group
 *   (e.g. "Admin", "Agent"). Inside each group, the role's labelled
 *   sub-sections (e.g. Organisation, Sales) are preserved as nested
 *   collapsibles; unlabelled sections are flattened to loose items at
 *   the top of the group. Each group is self-contained — items are NOT
 *   deduped across groups.
 */
export function getNavForRoles(roles: OrgRole[] | null | undefined): NavConfig {
  if (!roles || roles.length === 0) return AGENT_NAV;
  if (roles.length === 1) return getNavForRole(roles[0]);

  const ordered = roles.slice().sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0));
  const result: NavSection[] = [];

  for (const role of ordered) {
    const cfg = NAV_BY_ROLE[role] ?? [];
    const items: Array<NavItem | NavSection> = [];
    for (const section of cfg) {
      if (section.label) {
        items.push(section);
      } else {
        items.push(...section.items);
      }
    }
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
