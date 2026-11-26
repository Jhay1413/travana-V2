import { DealsView } from "@/features/portal";
import PortalLayout from "./portal-layout";

/** Portal Deals tab (new look). Everything lives in features/portal (DealsView). */
export default function PortalDealsPage() {
  return (
    <PortalLayout tone="light">
      <DealsView />
    </PortalLayout>
  );
}
