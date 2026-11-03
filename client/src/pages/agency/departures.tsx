import { DeparturesPage } from "@/features/departures";

/** /agency/departures and /agency/departures/balances. Owner, admin and branch manager (the route guard). */
export default function AgencyDeparturesRoute() {
  return <DeparturesPage />;
}
