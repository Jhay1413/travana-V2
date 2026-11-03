import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OrgRole } from "@/types/auth/auth.types";

export type MenuMode = "agent" | "admin";

// Roles that are allowed to switch the sidebar into the admin menu.
//
// This MUST be checked against useRole().orgRole (the single PRIMARY role),
// NOT useRoles().hasAnyRole. RoleRoute (role-route.tsx) authorises routes on
// orgRole alone, so a user whose primary role is "agent" but who also holds
// "org_admin" in orgRoles would be shown an admin menu whose every
// destination renders ForbiddenPage. Gating on orgRole guarantees every item
// in the menu is actually reachable.
export const ADMIN_MENU_ROLES: OrgRole[] = ["platform_admin", "org_admin"];

const MENU_MODE_STORAGE_KEY = "travana.menu-mode";

function isMenuMode(value: string): value is MenuMode {
  return value === "agent" || value === "admin";
}

function loadMenuMode(): MenuMode | null {
  try {
    const raw = window.localStorage.getItem(MENU_MODE_STORAGE_KEY);
    return raw && isMenuMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function saveMenuMode(mode: MenuMode | null) {
  try {
    if (mode === null) {
      window.localStorage.removeItem(MENU_MODE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(MENU_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Storage may be unavailable (private mode, quota) — the choice just won't persist.
  }
}

export interface MenuModeContextValue {
  mode: MenuMode | null;
  setMode: (m: MenuMode | null) => void;
}

const MenuModeContext = createContext<MenuModeContextValue | null>(null);

export function useMenuMode(): MenuModeContextValue {
  const ctx = useContext(MenuModeContext);
  if (!ctx) return { mode: null, setMode: () => {} };
  return ctx;
}

export function MenuModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MenuMode | null>(() => loadMenuMode());

  const setMode = useCallback((m: MenuMode | null) => {
    setModeState(m);
    saveMenuMode(m);
  }, []);

  const value = useMemo<MenuModeContextValue>(() => ({ mode, setMode }), [mode, setMode]);

  return <MenuModeContext.Provider value={value}>{children}</MenuModeContext.Provider>;
}
