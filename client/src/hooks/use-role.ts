import { useState, useCallback, useEffect } from "react";
import { useCurrentUser } from "./queries";
import type { Role } from "@/components/command-center-shell";

const ROLE_KEY = "apple-travel-role-preview";

export function useRole() {
  const { data: user } = useCurrentUser();
  const actualRole: Role = (user?.role as Role) || "Agent";

  const [rolePreview, setRolePreview] = useState<Role | null>(() => {
    const saved = sessionStorage.getItem(ROLE_KEY);
    return saved ? (saved as Role) : null;
  });

  const role: Role = rolePreview || actualRole;

  const setRole = useCallback((r: Role) => {
    if (r === actualRole) {
      sessionStorage.removeItem(ROLE_KEY);
      setRolePreview(null);
    } else {
      sessionStorage.setItem(ROLE_KEY, r);
      setRolePreview(r);
    }
  }, [actualRole]);

  useEffect(() => {
    if (rolePreview && rolePreview === actualRole) {
      sessionStorage.removeItem(ROLE_KEY);
      setRolePreview(null);
    }
  }, [actualRole, rolePreview]);

  return { role, setRole, actualRole };
}
