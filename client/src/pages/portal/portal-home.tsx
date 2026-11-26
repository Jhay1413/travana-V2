import { HomeView } from "@/features/portal";
import PortalLayout from "./portal-layout";
import PortalSetupWizard from "./portal-setup-wizard";

/**
 * Portal Home (new look). The install / notifications wizard still opens by itself, once per device, exactly as
 * before; everything else lives in features/portal (HomeView).
 */
export default function PortalHomePage() {
  return (
    <PortalLayout tone="light">
      <PortalSetupWizard />
      <HomeView />
    </PortalLayout>
  );
}
