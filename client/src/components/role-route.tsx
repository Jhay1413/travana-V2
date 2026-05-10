import { Route } from "wouter";
import type { ComponentType } from "react";
import { useRole } from "@/hooks/use-role";
import type { OrgRole } from "@/types/auth/auth.types";
import ForbiddenPage from "@/pages/forbidden";

interface RoleRouteProps {
  path: string;
  allow: OrgRole[];
  component: ComponentType<any>;
}

export function RoleRoute({ path, allow, component: Component }: RoleRouteProps) {
  const { orgRole } = useRole();
  const isAllowed = allow.includes(orgRole);

  return (
    <Route path={path}>
      {(params) => (isAllowed ? <Component {...params} /> : <ForbiddenPage />)}
    </Route>
  );
}
