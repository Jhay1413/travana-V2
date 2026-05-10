import {
  Activity,
  Banknote,
  BadgeCheck,
  BarChart3,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Compass,
  FileText,
  Gift,
  LayoutGrid,
  LifeBuoy,
  Link2,
  ListChecks,
  MessageSquare,
  Phone,
  Settings2,
  Share2,
  Shield,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
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
      { path: "/", label: "Overview", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy },
      { path: "/?s=connect-internal-chat", label: "Live Chat", icon: MessageSquare },
      { path: "/social-posts", label: "Social Posts", icon: Share2 },
      { path: "/destination-guru", label: "Destination Guru", icon: Sparkles },
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/?s=opportunities", label: "Opportunities", icon: Target },
    ],
  },
];

const BRANCH_MANAGER_NAV: NavConfig = [
  {
    id: "main",
    items: [
      { path: "/", label: "Branch Overview", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/bookings", label: "Bookings", icon: ClipboardList },
      { path: "/agency/team", label: "Team", icon: Users },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy },
      { path: "/tasks", label: "Tasks", icon: ListChecks },
      { path: "/reports", label: "Reports", icon: FileText },
    ],
  },
];

const ORG_ADMIN_NAV: NavConfig = [
  {
    id: "owner",
    label: "Agency Settings",
    icon: Building2,
    items: [
      { path: "/agency/team", label: "Team & Seats", icon: Users },
      { path: "/agency/permissions", label: "Roles & Permissions", icon: Shield },
      { path: "/agency/branding", label: "White-label Branding", icon: Sparkles },
      { path: "/agency/billing", label: "Billing & Plan", icon: CircleDollarSign },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    items: [
      { path: "/", label: "Overview", icon: LayoutGrid },
      { path: "/?s=org", label: "Organisation", icon: Building2 },
      { path: "/?s=users", label: "Users & Roles", icon: Shield },
      { path: "/?s=audit", label: "Audit", icon: Activity },
      { path: "/?s=financials", label: "Revenue Dashboard", icon: Banknote },
      { path: "/?s=referrals", label: "Referrals", icon: Gift },
      { path: "/sms-center", label: "Texts", icon: MessageSquare },
      { path: "/?s=admin-settings-page", label: "Admin Settings", icon: Settings2 },
      { path: "/?s=settings", label: "Data Settings", icon: ClipboardList },
    ],
  },
  {
    id: "agent",
    label: "Agent Tools",
    icon: Users,
    items: [
      { path: "/?s=agent-overview", label: "Overview", icon: LayoutGrid },
      { path: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { path: "/tickets", label: "Tickets", icon: LifeBuoy },
      { path: "/?s=connect-internal-chat", label: "Live Chat", icon: MessageSquare },
      { path: "/social-posts", label: "Social Posts", icon: Share2 },
      { path: "/destination-guru", label: "Destination Guru", icon: Sparkles },
      { path: "/sms-center", label: "Texts", icon: MessageSquare },
      { path: "/clients", label: "Clients", icon: Users },
      { path: "/?s=opportunities", label: "Opportunities", icon: Target },
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
