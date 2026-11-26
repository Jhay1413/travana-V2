import { QuotesView } from "@/features/portal";
import PortalLayout from "./portal-layout";

/** /portal/quotes: the design's "My quotes" screen. */
export default function PortalQuotesPage() {
  return (
    <PortalLayout tone="light">
      <QuotesView />
    </PortalLayout>
  );
}
