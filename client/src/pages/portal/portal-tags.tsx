import { InterestsView, PortalThemeScope } from "@/features/portal";

/** Portal travel interests (new look). Shown without the tab bar: customers are sent here on first login. */
export default function PortalTagsPage() {
  return (
    <PortalThemeScope>
      <InterestsView />
    </PortalThemeScope>
  );
}
