import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRole } from "@/hooks/use-role";
import { getNavForRole, type NavItem } from "@/config/nav";

function isActive(currentPath: string, currentSearch: string, itemPath: string): boolean {
  const [path, query] = itemPath.split("?");
  if (query) {
    const itemParams = new URLSearchParams(query);
    const currentParams = new URLSearchParams(currentSearch);
    for (const [k, v] of itemParams.entries()) {
      if (currentParams.get(k) !== v) return false;
    }
    return currentPath === (path || "/");
  }
  if (itemPath === "/") return currentPath === "/" && !currentSearch;
  return currentPath === itemPath || currentPath.startsWith(itemPath + "/");
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} data-testid={`nav-${item.path.replace(/[^a-z0-9]/gi, "-")}`}>
        <Link href={item.path}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidenav() {
  const { orgRole } = useRole();
  const [location] = useLocation();
  const sections = getNavForRole(orgRole);

  const currentPath = location.split("?")[0] || "/";
  const currentSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";

  return (
    <Sidebar collapsible="icon" data-testid="app-sidenav">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-lg font-semibold">Travana</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.id}>
            {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavLink
                    key={item.path + item.label}
                    item={item}
                    active={isActive(currentPath, currentSearch, item.path)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
