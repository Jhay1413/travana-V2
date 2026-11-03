import type { QueryClient } from "@tanstack/react-query";
import { homeworkerKeys } from "./use-homeworker-queries";
import { branchKeys } from "@/features/organization/api/use-branch-queries";
import { organizationOverviewKeys } from "@/features/organization/api/use-organization-overview-queries";

type Invalidator = Pick<QueryClient, "invalidateQueries">;

/** Everything a homeworker create/update/archive/revoke can change: list, branch pickers and the org overview. */
export function invalidateHomeworkerData(qc: Invalidator): void {
  qc.invalidateQueries({ queryKey: homeworkerKeys.all });
  qc.invalidateQueries({ queryKey: branchKeys.list("homeworker") });
  qc.invalidateQueries({ queryKey: organizationOverviewKeys.all });
}
