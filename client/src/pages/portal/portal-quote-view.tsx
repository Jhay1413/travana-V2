import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { QuoteDetailView } from "@/features/portal";
import { getPortalToken } from "@/hooks/use-portal-api";
import PortalLayout from "./portal-layout";

/** /portal/quote/:token: one quote in the new look. Signed-out visitors go to sign-in and come back here. */
export default function PortalQuoteViewPage() {
  const [, params] = useRoute("/portal/quote/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const isAuthed = getPortalToken() !== null;

  useEffect(() => {
    if (!isAuthed) setLocation(`/portal/login?next=${encodeURIComponent(`/portal/quote/${token}`)}`);
  }, [isAuthed, setLocation, token]);

  if (!isAuthed) return null;

  return (
    <PortalLayout tone="light">
      <QuoteDetailView token={token} />
    </PortalLayout>
  );
}
