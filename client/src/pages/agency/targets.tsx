import { AgencyTargetsPage } from "@/features/targets";

/** /agency/targets and its sub-routes (shops, agents, homeworkers, allocate). Owner / admin only (the route guard). */
export default function AgencyTargetsRoute() {
  return <AgencyTargetsPage />;
}
