import { SetupWizard } from "@/features/portal";

export { OPEN_SETUP_WIZARD_EVENT } from "@/features/portal";

/**
 * The install / notifications wizard (new look). It opens by itself once per device on Home; `manualOnly` makes it
 * open only when OPEN_SETUP_WIZARD_EVENT fires (the Account page). Everything lives in features/portal (SetupWizard).
 */
export default function PortalSetupWizard({ manualOnly = false }: { manualOnly?: boolean } = {}) {
  return <SetupWizard manualOnly={manualOnly} />;
}
