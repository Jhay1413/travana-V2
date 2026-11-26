// Public surface of the customer-portal feature: import it from here, not from deep paths.
export { PortalThemeProvider, PortalThemeScope, usePortalTheme, usePortalBrandingValue, usePortalOverlayContainer } from "./theme/PortalThemeProvider";
export { resolveBrandPalette, paletteToCssVars, normaliseHex, readableForeground, PORTAL_NAVY, PORTAL_CREAM } from "./theme/brand-colour";
export type { BrandPalette, BrandMode } from "./theme/brand-colour";
export { loadPortalFonts } from "./theme/portal-fonts";

export { PORTAL_ENDPOINTS } from "./api/portal-endpoints";
export { NEUTRAL_BRANDING, displayName, parseBranding, resolvePortalSlug } from "./api/portal-branding";
export type { PortalBranding } from "./api/portal-branding";
export { usePortalBranding } from "./api/use-portal-branding";
export { usePortalPinReset, PIN_RESET_CONFIRMATION } from "./api/use-portal-pin-reset";
export { usePortalPush, pushSupported } from "./api/use-portal-push";
export type { PortalPushState } from "./api/use-portal-push";
export { usePortalFaceId, findThisDevice, FACE_ID_REAUTH_MESSAGE } from "./api/use-portal-face-id";
export { signOutPortal } from "./api/portal-session";

export { PORTAL_TABS, TRIPS_SEGMENTS, activeTabForPath, tripsSegmentForPath, portalRedirectTarget, portalNextTarget, withoutParams, interestsRedirectTarget } from "./portal-nav";
export type { PortalTab, PortalTabKey, TripsSegment } from "./portal-nav";

export { AgencyMark, Eyebrow, FactList, PortalButton, PortalHero, PortalSection, SplitHeading, portalButtonClass } from "./components/brand";
export { PinField, sanitisePin } from "./components/PinField";
export { PortalDialog } from "./components/PortalDialog";
export { PortalFooter } from "./components/PortalFooter";
export { PortalHeader } from "./components/PortalHeader";
export { PortalTabBar } from "./components/PortalTabBar";
export { PortalField } from "./components/PortalField";

export { prefillFromSearch, aboutParam } from "./lib/message-prefill";
export { QuotesView } from "./components/quotes/QuotesView";
export { QuoteDetailView } from "./components/quotes/QuoteDetailView";
export { usePortalQuoteList, usePortalQuote, usePortalQuoteAction, portalQuoteKeys } from "./api/use-portal-quotes";
export { BookingsView } from "./components/bookings/BookingsView";
export { BookingDetailView } from "./components/bookings/BookingDetailView";
export { usePortalBookingList, usePortalBooking, portalBookingKeys } from "./api/use-portal-bookings";
export { HomeView } from "./components/home/HomeView";
export { usePortalSummary, usePortalDealInterest, portalSummaryKey } from "./api/use-portal-summary";
export { DealsView } from "./components/deals/DealsView";
export { MessagesView } from "./components/messages/MessagesView";
export { RewardsView } from "./components/rewards/RewardsView";
export { InterestsView } from "./components/interests/InterestsView";
export { SetupWizard } from "./components/setup/SetupWizard";
export { OPEN_SETUP_WIZARD_EVENT } from "./lib/setup-wizard";
