import { IntegrationsPage } from "@/features/integrations";

/** /agency/integrations. Manager roles only (the route guard decides). */
export default function AgencyIntegrationsRoute() {
  return <IntegrationsPage />;
}
