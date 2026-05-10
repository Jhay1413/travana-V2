import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import ForbiddenPage from "@/pages/forbidden";
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
import AgentOverviewPage from "@/pages/agent-overview";
import BranchOverviewPage from "@/pages/branch-overview";
import ClientsPage from "@/pages/clients";
import ClientPage from "@/pages/client";
import QuotePage from "@/pages/quote"; // Using original full-featured version
import EnquiryPage from "@/pages/enquiry";
import TicketsPage from "@/pages/tickets";
import AdminImportPage from "@/pages/admin-import";
import AdminLookupPage from "@/pages/admin-lookup";
import SettingsLookupPage from "@/pages/settings-lookup";
import BookingPage from "@/pages/booking-standalone";
import BookingsPage from "@/pages/bookings";
import TasksPage from "@/pages/tasks";
import ReportsPage from "@/pages/reports";
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
import { AppLayout } from "@/components/layout/app-layout";
import { RoleRoute } from "@/components/role-route";
import type { OrgRole } from "@/types/auth/auth.types";

const ALL_ROLES: OrgRole[] = [
  "platform_admin",
  "org_admin",
  "branch_manager",
  "agent",
  "homeworker",
  "referral_agent",
];
const STAFF_ROLES: OrgRole[] = ["platform_admin", "org_admin", "branch_manager", "agent", "homeworker"];
const MANAGER_ROLES: OrgRole[] = ["platform_admin", "org_admin", "branch_manager"];
const ADMIN_ROLES: OrgRole[] = ["platform_admin", "org_admin"];
const PLATFORM_ROLES: OrgRole[] = ["platform_admin"];
const REFERRAL_ROLES: OrgRole[] = ["referral_agent", "platform_admin"];
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
  const { orgRole } = useRole();
  const homePath =
    orgRole === "referral_agent"
      ? "/referral-hub"
      : orgRole === "platform_admin"
        ? "/platform-admin"
        : orgRole === "branch_manager"
          ? "/branch-overview"
          : "/agent-overview";

  return (
    <AppLayout>
      <Switch>
        <Route path="/">{() => <Redirect to={homePath} />}</Route>
        <Route path="/welcome-team" component={WelcomeTeamPage} />
        <Route path="/forbidden" component={ForbiddenPage} />

        <RoleRoute path="/agent-overview" allow={STAFF_ROLES} component={AgentOverviewPage} />
        <RoleRoute path="/branch-overview" allow={MANAGER_ROLES} component={BranchOverviewPage} />

        <RoleRoute path="/platform-admin" allow={PLATFORM_ROLES} component={PlatformAdminPage} />
        <RoleRoute path="/referral-hub" allow={REFERRAL_ROLES} component={ReferralAgentDashboard} />

        <RoleRoute path="/agency/team" allow={ADMIN_ROLES} component={SettingsTeamPage} />
        <RoleRoute path="/agency/permissions" allow={ADMIN_ROLES} component={SettingsPermissionsPage} />
        <RoleRoute path="/agency/branding" allow={ADMIN_ROLES} component={SettingsBrandingPage} />
        <RoleRoute path="/agency/billing" allow={ADMIN_ROLES} component={SettingsBillingPage} />
        <RoleRoute path="/admin/import" allow={ADMIN_ROLES} component={AdminImportPage} />
        <RoleRoute path="/admin/lookup/:tableSlug" allow={ADMIN_ROLES} component={AdminLookupPage} />
        <RoleRoute path="/settings/:tableSlug" allow={ADMIN_ROLES} component={SettingsLookupPage} />
        <RoleRoute path="/hr" allow={ADMIN_ROLES} component={HrPage} />

        <RoleRoute path="/bookings" allow={MANAGER_ROLES} component={BookingsPage} />
        <RoleRoute path="/tasks" allow={MANAGER_ROLES} component={TasksPage} />
        <RoleRoute path="/reports" allow={MANAGER_ROLES} component={ReportsPage} />

        <RoleRoute path="/clients" allow={STAFF_ROLES} component={ClientsPage} />
        <RoleRoute path="/clients/:clientId" allow={STAFF_ROLES} component={ClientPage} />
        <RoleRoute path="/clients/:clientId/quotes/:quoteId" allow={STAFF_ROLES} component={QuotePage} />
        <RoleRoute path="/quotes/:quoteId" allow={STAFF_ROLES} component={QuotePage} />
        <RoleRoute path="/clients/:clientId/bookings/:quoteId" allow={STAFF_ROLES} component={BookingPage} />
        <RoleRoute path="/bookings/:quoteId" allow={STAFF_ROLES} component={BookingPage} />
        <RoleRoute path="/clients/:clientId/enquiries/:enquiryId" allow={STAFF_ROLES} component={EnquiryPage} />
        <RoleRoute path="/enquiries/:enquiryId" allow={STAFF_ROLES} component={EnquiryPage} />
        <RoleRoute path="/pipeline" allow={STAFF_ROLES} component={PipelinePage} />
        <RoleRoute path="/destination-guru" allow={STAFF_ROLES} component={DestinationGuruPage} />
        <RoleRoute path="/sms-center" allow={STAFF_ROLES} component={SmsCenterPage} />
        <RoleRoute path="/social-posts" allow={STAFF_ROLES} component={SocialPostsPage} />
        <RoleRoute path="/social-posts/quotes/:quoteId" allow={STAFF_ROLES} component={SocialQuotePage} />
        <RoleRoute path="/tickets" allow={STAFF_ROLES} component={TicketsPage} />
        <RoleRoute path="/tickets/:ticketId" allow={STAFF_ROLES} component={TicketsPage} />
        <RoleRoute path="/hub/:rest*" allow={STAFF_ROLES} component={HubPage} />
        <RoleRoute path="/hub" allow={STAFF_ROLES} component={HubPage} />
        <RoleRoute path="/feedback" allow={ALL_ROLES} component={FeedbackPage} />

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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