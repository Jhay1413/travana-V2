import { BookingsView } from "@/features/portal";
import PortalLayout from "./portal-layout";

/** /portal/bookings: the design's "My bookings" screen (the next holiday in full, then the rest). */
export default function PortalBookingsPage() {
  return (
    <PortalLayout tone="light">
      <BookingsView />
    </PortalLayout>
  );
}
