import {
  Activity,
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileText,
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
  Sparkles,
  Target,
  TrendingUp,
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
      { path: "/agency/overview", label: "Agency Overview", icon: LayoutGrid },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    icon: Building2,
    items: [
      { path: "/agency/profile", label: "Profile & Branding", icon: Sparkles },
      { path: "/agency/branches", label: "Branches", icon: Building2 },
      { path: "/agency/team", label: "Team & Roles", icon: Users },
      { path: "/agency/targets", label: "Targets", icon: Target },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CircleDollarSign,
    items: [
      { path: "/agency/billing", label: "Plan & Seats", icon: CircleDollarSign },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    items: [
      { path: "/hr", label: "HR", icon: HeartHandshake },
      { path: "/agency/tour-operators", label: "Tour Operators", icon: Plane },
      { path: "/agency/templates", label: "Templates", icon: FileText },
      { path: "/agency/data", label: "Reference Data", icon: ClipboardList },
      { path: "/agency/audit", label: "Audit Log", icon: Activity },
    ],
  },
];

const PLATFORM_ADMIN_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/platform-admin", label: "All Agencies", icon: Building2 },
      { path: "/", label: "Demo Workspace", icon: LayoutGrid },
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
