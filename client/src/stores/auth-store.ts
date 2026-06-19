import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/types/auth";

// Auth state lifecycle:
//  - "unknown"          → no confirmed answer yet (first load, still validating)
//  - "authenticated"    → backend confirmed a session
//  - "unauthenticated"  → backend confirmed there is no session
//
// The persisted `user` lets the app render optimistically on reload (no loading
// flash), but it is NOT a credential: the httpOnly session cookie is the source
// of truth, every API request is validated server-side, and `useAuthSync`
// re-validates against /api/auth/user on load. A 401 clears this store.
export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  /** Apply a backend-confirmed result (null = no session). */
  setUser: (user: AuthUser | null) => void;
  /** Force unauthenticated (e.g. after logout / 401). */
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      status: "unknown",
      setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
      clear: () => set({ user: null, status: "unauthenticated" }),
    }),
    {
      name: "auth-user",
      // Persist only the profile (for optimistic render). `status` is intentionally
      // NOT persisted, so it resets to "unknown" on reload and the app still
      // revalidates the session against the backend.
      partialize: (s) => ({ user: s.user }),
    },
  ),
);

// Selector hooks — components read these instead of re-running an auth fetch.
export const useAuthUser = () => useAuthStore((s) => s.user);
export const useAuthStatus = () => useAuthStore((s) => s.status);
// Optimistic: a persisted user counts as authenticated until the backend says otherwise.
export const useIsAuthenticated = () =>
  useAuthStore((s) => s.status === "authenticated" || (s.status === "unknown" && !!s.user));
