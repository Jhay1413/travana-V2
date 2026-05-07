import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import SignupAgencyPage from "@/pages/signup-agency";
import WelcomeTeamPage from "@/pages/welcome-team";
import SettingsTeamPage from "@/pages/settings-team";
import SettingsPermissionsPage from "@/pages/settings-permissions";
import SettingsBrandingPage from "@/pages/settings-branding";
import SettingsBillingPage from "@/pages/settings-billing";
import PlatformAdminPage from "@/pages/platform-admin";
import ReferralAgentDashboard from "@/pages/referral-agent";
import { useRole } from "@/hooks/use-role";
import { BrandingApplier } from "@/components/branding-applier";
import PublicQuotePage from "@/pages/public-quote";
import CommandCenterPage from "@/pages/command-center";
import ClientsPage from "@/pages/clients";
import ClientPage from "@/pages/client";
import QuotePage from "@/pages/quote"; // Using original full-featured version
import EnquiryPage from "@/pages/enquiry";
import TicketsPage from "@/pages/tickets";
import AdminImportPage from "@/pages/admin-import";
import AdminLookupPage from "@/pages/admin-lookup";
import SettingsLookupPage from "@/pages/settings-lookup";
import BookingPage from "@/pages/booking-standalone";
import PipelinePage from "@/pages/pipeline";
import HubPage from "@/pages/hub";
import SocialPostsPage from "@/pages/social-posts";
import SocialQuotePage from "@/pages/social-quote";
import DestinationGuruPage from "@/pages/destination-guru";
import SmsCenterPage from "@/pages/sms-center";
import HrPage from "@/pages/hr";
import FeedbackPage from "@/pages/feedback";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import TravanaRouter from "@/pages/travana";
import PortalLoginPage from "@/pages/portal/portal-login";
import PortalHomePage from "@/pages/portal/portal-home";
import PortalQuotesPage from "@/pages/portal/portal-quotes";
import PortalBookingsPage from "@/pages/portal/portal-bookings";
import PortalDealsPage from "@/pages/portal/portal-deals";
import PortalMessagesPage from "@/pages/portal/portal-messages";
import PortalQuoteViewPage from "@/pages/portal/portal-quote-view";
import PortalTagsPage from "@/pages/portal/portal-tags";
import PortalReferralsPage from "@/pages/portal/portal-referrals";
import { Loader2 } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-white/60 animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedRouter() {
  const { role } = useRole();
  return (
    <Switch>
      <Route path="/" component={role === "Referer" ? ReferralAgentDashboard : role === "PlatformAdmin" ? PlatformAdminPage : CommandCenterPage} />
      <Route path="/welcome-team" component={WelcomeTeamPage} />
      <Route path="/platform-admin" component={PlatformAdminPage} />
      <Route path="/agency/team" component={SettingsTeamPage} />
      <Route path="/agency/permissions" component={SettingsPermissionsPage} />
      <Route path="/agency/branding" component={SettingsBrandingPage} />
      <Route path="/agency/billing" component={SettingsBillingPage} />
      <Route path="/referral-hub" component={ReferralAgentDashboard} />
      <Route path="/command-center" component={CommandCenterPage} />
      <Route path="/clients" component={CommandCenterPage} />
      <Route path="/clients/:clientId" component={ClientPage} />
      <Route path="/clients/:clientId/quotes/:quoteId" component={QuotePage} />
      <Route path="/quotes/:quoteId" component={QuotePage} />
      <Route path="/clients/:clientId/bookings/:quoteId" component={BookingPage} />
      <Route path="/bookings/:quoteId" component={BookingPage} />
      <Route path="/clients/:clientId/enquiries/:enquiryId" component={EnquiryPage} />
      <Route path="/enquiries/:enquiryId" component={EnquiryPage} />
      <Route path="/pipeline" component={PipelinePage} />
      <Route path="/destination-guru" component={DestinationGuruPage} />
      <Route path="/sms-center" component={SmsCenterPage} />
      <Route path="/hr" component={HrPage} />
      <Route path="/social-posts" component={SocialPostsPage} />
      <Route path="/social-posts/quotes/:quoteId" component={SocialQuotePage} />
      <Route path="/tickets" component={TicketsPage} />
      <Route path="/tickets/:ticketId" component={TicketsPage} />
      <Route path="/hub/:rest*" component={HubPage} />
      <Route path="/hub" component={HubPage} />
      <Route path="/admin/import" component={AdminImportPage} />
      <Route path="/admin/lookup/:tableSlug" component={AdminLookupPage} />
      <Route path="/settings/:tableSlug" component={SettingsLookupPage} />
      <Route path="/feedback" component={FeedbackPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (location === "/portal" || location.startsWith("/portal/")) {
    return (
      <Switch>
        <Route path="/portal/login" component={PortalLoginPage} />
        <Route path="/portal/tags" component={PortalTagsPage} />
        <Route path="/portal/quote/:token" component={PortalQuoteViewPage} />
        <Route path="/portal/quotes" component={PortalQuotesPage} />
        <Route path="/portal/bookings" component={PortalBookingsPage} />
        <Route path="/portal/deals" component={PortalDealsPage} />
        <Route path="/portal/messages" component={PortalMessagesPage} />
        <Route path="/portal/referrals" component={PortalReferralsPage} />
        <Route path="/portal" component={PortalHomePage} />
        <Route path="/portal/:rest*" component={PortalHomePage} />
      </Switch>
    );
  }

  if (location === "/travana" || location.startsWith("/travana/")) {
    return <TravanaRouter />;
  }

  if (location.startsWith("/view-quote/")) {
    return (
      <Switch>
        <Route path="/view-quote/:token" component={PublicQuotePage} />
      </Switch>
    );
  }

  if (location === "/forgot-password") {
    return <ForgotPasswordPage />;
  }

  if (location === "/signup" || location === "/signup-agency") {
    return <SignupAgencyPage />;
  }

  if (location.startsWith("/reset-password")) {
    if (location === "/reset-password" || location === "/reset-password/") {
      window.location.href = "/forgot-password";
      return null;
    }
    return (
      <Switch>
        <Route path="/reset-password/:token" component={ResetPasswordPage} />
      </Switch>
    );
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <>
      <BrandingApplier />
      <AuthenticatedRouter />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;