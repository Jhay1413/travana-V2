import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { BookingDetailView } from "@/features/portal";
import { getPortalToken } from "@/hooks/use-portal-api";
import PortalLayout from "./portal-layout";

/** /portal/booking/:id: one booking in the new look. Signed-out visitors go to sign-in and come back here. */
export default function PortalBookingViewPage() {
  const [, params] = useRoute("/portal/booking/:id");
  const id = params?.id || "";
  const [, setLocation] = useLocation();
  const isAuthed = getPortalToken() !== null;

  useEffect(() => {
    if (!isAuthed) setLocation(`/portal/login?next=${encodeURIComponent(`/portal/booking/${id}`)}`);
  }, [isAuthed, setLocation, id]);

  if (!isAuthed) return null;

  return (
    <PortalLayout tone="light">
      <BookingDetailView id={id} />
    </PortalLayout>
  );
}
