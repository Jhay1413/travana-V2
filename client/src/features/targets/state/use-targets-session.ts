import { useMemo } from "react";
import { useCurrentUser } from "@/hooks/queries";
import { londonYearMonth } from "@/lib/london-day";

/** Who is looking, and which year counts as "this year" (London calendar). */
export function useTargetsSession(): { currentYear: number; orgId: string | null; userId: string | null } {
  const { data: user } = useCurrentUser();
  const currentYear = useMemo(() => londonYearMonth(new Date()).year, []);
  return { currentYear, orgId: user?.orgId ?? null, userId: user?.id ?? null };
}
