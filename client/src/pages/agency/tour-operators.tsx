import { TourOperatorsPage } from "@/features/tour-operators";

/** /agency/tour-operators. Owners, admins and branch managers edit; agents and homeworkers read (the route guard and the server decide). */
export default function AgencyTourOperatorsRoute() {
  return <TourOperatorsPage />;
}
