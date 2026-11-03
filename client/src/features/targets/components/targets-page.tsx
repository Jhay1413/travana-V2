import { useLocation, useSearch } from "wouter";
import { isAllocatePath, parseYear, tabFromPath } from "../lib/routes";
import { useTargetsSession } from "../state/use-targets-session";
import { TargetsOverview } from "./targets-overview";
import { WizardPage } from "./wizard/wizard-page";

/** Everything under /agency/targets: the four tabs, or the guided allocation at /agency/targets/allocate. */
export function AgencyTargetsPage() {
  const [pathname] = useLocation();
  const search = useSearch();
  const { currentYear } = useTargetsSession();
  const year = parseYear(search, currentYear);
  if (isAllocatePath(pathname)) return <WizardPage year={year} />;
  return <TargetsOverview tab={tabFromPath(pathname)} year={year} />;
}
