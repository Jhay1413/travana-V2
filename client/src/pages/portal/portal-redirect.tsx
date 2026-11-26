import { Redirect, useLocation } from "wouter";
import { portalRedirectTarget } from "@/features/portal";

/** Sends an old portal URL (the old Trips paths) to where it now lives. */
export default function PortalLegacyRedirect() {
  const [location] = useLocation();
  const target = portalRedirectTarget(location, window.location.search, window.location.hash);
  return <Redirect to={target ?? "/portal"} replace />;
}
