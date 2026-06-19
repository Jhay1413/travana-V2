import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/queries";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Single source-of-truth session validation. Runs the `/api/auth/user` query
 * (useCurrentUser) once and mirrors the backend-confirmed result into the global
 * auth store. Mount exactly once near the app root. Every visit/reload still
 * hits the backend here, so the persisted store never bypasses server auth.
 */
export function useAuthSync() {
  const { data, isFetched, isError } = useCurrentUser();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (isFetched || isError) {
      setUser(data ?? null);
    }
  }, [data, isFetched, isError, setUser]);
}
