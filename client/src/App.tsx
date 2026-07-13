import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "@/api/queryClient";
import { authKeys } from "@/hooks/queries/use-auth-queries";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useRole } from "@/hooks/use-role";
import { BrandingApplier } from "@/components/branding-applier";
import { AppLayout } from "@/components/layout/app-layout";
import { RoleRoute } from "@/components/role-route";
// EmailInbox lives in components/ (not pages/) — kept as a static import.
import EmailInbox from "@/features/email/components/email-inbox";
// PortalPinGate is a named export used as a layout wrapper — kept static.
import { PortalPinGate } from "@/pages/portal/portal-pin-gate";
import { Loader2 } from "lucide-react";
import type { OrgRole } from "@/types/auth/auth.types";
import { BotSettingsPage, KnowledgeBasePage } from "@/features/ai-assistant";

// ── Lazy page imports ──────────────────────────────────────────────────────────
const NotFound = lazy(() => import("@/pages/not-found"));
const ForbiddenPage = lazy(() => import("@/pages/forbidden"));
const LandingPage = lazy(() => import("@/pages/landing"));
const SignupAgencyPage = lazy(() => import("@/pages/signup-agency"));
const WelcomeTeamPage = lazy(() => import("@/pages/welcome-team"));
const AgencyPage = lazy(() => import("@/pages/agency"));
const PlatformAdminDashboard = lazy(() => import("@/pages/platform-admin/dashboard"));
const PlatformAdminPage = lazy(() => import("@/pages/platform-admin/index"));
const PlatformAdminOrgPage = lazy(() => import("@/pages/platform-admin/org"));
const PlatformAdminUsersPage = lazy(() => import("@/pages/platform-admin/users"));
const PlatformAdminAuditPage = lazy(() => import("@/pages/platform-admin/audit"));
const ReferralAgentDashboard = lazy(() => import("@/pages/referral-agent"));
const PublicQuotePage = lazy(() => import("@/pages/public-quote"));
const AgentOverviewPage = lazy(() => import("@/pages/agent-overview"));
const AgentStatsPage = lazy(() => import("@/pages/agent-stats"));
const BranchOverviewPage = lazy(() => import("@/pages/branch-overview"));
const OrganizationOverviewPage = lazy(() => import("@/pages/organization-overview"));
const ClientsPage = lazy(() => import("@/pages/clients"));
const ClientsListPage = lazy(() => import("@/pages/clients-list"));
const ClientPage = lazy(() => import("@/pages/client"));
const QuotePage = lazy(() => import("@/pages/quote"));
const EnquiryPage = lazy(() => import("@/pages/enquiry"));
const TicketsPage = lazy(() => import("@/pages/tickets"));
const AdminImportPage = lazy(() => import("@/pages/admin-import"));
const AdminLookupPage = lazy(() => import("@/pages/admin-lookup"));
const SettingsLookupPage = lazy(() => import("@/pages/settings-lookup"));
const BookingPage = lazy(() => import("@/pages/booking-standalone"));
const BookingsPage = lazy(() => import("@/pages/bookings"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const PipelinePage = lazy(() => import("@/pages/pipeline"));
const ChatPage = lazy(() => import("@/pages/chat"));
const ConversationsPage = lazy(() => import("@/pages/conversations"));
const HubPage = lazy(() => import("@/pages/hub"));
const SocialPostsPage = lazy(() => import("@/pages/social-posts"));
const SocialQuotePage = lazy(() => import("@/pages/social-quote"));
const SocialWallPage = lazy(() => import("@/pages/social-wall"));
const DestinationGuruPage = lazy(() => import("@/pages/destination-guru"));
const SmsCenterPage = lazy(() => import("@/pages/sms-center"));
const HrPage = lazy(() => import("@/pages/hr"));
const HrV2Page = lazy(() => import("@/pages/hr-v2"));
const BranchTargetsPage = lazy(() => import("@/pages/branch-targets"));
const OpportunitiesPage = lazy(() => import("@/pages/opportunities"));
const MyProfilePage = lazy(() => import("@/pages/my-profile"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const VerifyEmailPendingPage = lazy(() => import("@/pages/verify-email-pending"));
const AcceptInvitePage = lazy(() => import("@/pages/accept-invite"));
const TravanaRouter = lazy(() => import("@/pages/travana"));
const CruiseQuotePreviewPage = lazy(() => import("@/pages/cruise-quote-preview"));
// Portal pages
const PortalLoginPage = lazy(() => import("@/pages/portal/portal-login"));
const PortalHomePage = lazy(() => import("@/pages/portal/portal-home"));
const PortalQuotesPage = lazy(() => import("@/pages/portal/portal-quotes"));
const PortalBookingsPage = lazy(() => import("@/pages/portal/portal-bookings"));
const PortalDealsPage = lazy(() => import("@/pages/portal/portal-deals"));
const PortalMessagesPage = lazy(() => import("@/pages/portal/portal-messages"));
const PortalQuoteViewPage = lazy(() => import("@/pages/portal/portal-quote-view"));
const PortalTagsPage = lazy(() => import("@/pages/portal/portal-tags"));
const PortalReferralsPage = lazy(() => import("@/pages/portal/portal-referrals"));
// ──────────────────────────────────────────────────────────────────────────────

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
  const [location] = useLocation();
  const homePath =
    orgRole === "referral_agent"
      ? "/referral-hub"
      : orgRole === "platform_admin"
        ? "/platform-admin"
        : orgRole === "org_admin"
          ? "/agency/overview"
          : orgRole === "branch_manager"
            ? "/branch-overview"
            : "/agent-overview";

  // TheHUB ships its own full-page shell (HubShell) and must NOT inherit the CRM
  // AppLayout chrome. Render it standalone — still auth-gated (we're inside
  // AuthenticatedRouter) and role-gated to staff, mirroring the /portal and
  // /travana early-returns above.
  if (location === "/hub" || location.startsWith("/hub/")) {
    return STAFF_ROLES.includes(orgRole) ? <HubPage /> : <ForbiddenPage />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/">{() => <Redirect to={homePath} />}</Route>
        <Route path="/welcome-team" component={WelcomeTeamPage} />
        <Route path="/forbidden" component={ForbiddenPage} />

        <RoleRoute path="/agent-overview" allow={STAFF_ROLES} component={AgentOverviewPage} />
        <RoleRoute path="/branch-overview" allow={MANAGER_ROLES} component={BranchOverviewPage} />
        <RoleRoute path="/agency/overview" allow={ADMIN_ROLES} component={OrganizationOverviewPage} />
        <RoleRoute path="/agents/:agentId" allow={MANAGER_ROLES} component={AgentStatsPage} />

        <RoleRoute path="/platform-admin/audit-log" allow={PLATFORM_ROLES} component={PlatformAdminAuditPage} />
        <RoleRoute path="/platform-admin/users" allow={PLATFORM_ROLES} component={PlatformAdminUsersPage} />
        <RoleRoute path="/platform-admin/organizations/:id" allow={PLATFORM_ROLES} component={PlatformAdminOrgPage} />
        <RoleRoute path="/platform-admin/organizations" allow={PLATFORM_ROLES} component={PlatformAdminPage} />
        <RoleRoute path="/platform-admin" allow={PLATFORM_ROLES} component={PlatformAdminDashboard} />
        <RoleRoute path="/referral-hub" allow={REFERRAL_ROLES} component={ReferralAgentDashboard} />

        <RoleRoute path="/agency/team" allow={MANAGER_ROLES} component={AgencyPage} />
        <RoleRoute path="/agency/*" allow={ADMIN_ROLES} component={AgencyPage} />
        <RoleRoute path="/agency" allow={ADMIN_ROLES} component={AgencyPage} />
        <RoleRoute path="/admin/import" allow={ADMIN_ROLES} component={AdminImportPage} />
        <RoleRoute path="/admin/lookup/:tableSlug" allow={ADMIN_ROLES} component={AdminLookupPage} />
        <RoleRoute path="/settings/bot" allow={ADMIN_ROLES} component={BotSettingsPage} />
        <RoleRoute path="/settings/knowledge-base" allow={ADMIN_ROLES} component={KnowledgeBasePage} />
        <RoleRoute path="/settings/:tableSlug" allow={ADMIN_ROLES} component={SettingsLookupPage} />
        <RoleRoute path="/hr" allow={MANAGER_ROLES} component={HrPage} />
        <RoleRoute path="/hr-v2" allow={MANAGER_ROLES} component={HrV2Page} />
        <RoleRoute path="/branch/targets" allow={MANAGER_ROLES} component={BranchTargetsPage} />

        <RoleRoute path="/bookings" allow={MANAGER_ROLES} component={BookingsPage} />
        <RoleRoute path="/tasks" allow={MANAGER_ROLES} component={TasksPage} />
        <RoleRoute path="/reports" allow={MANAGER_ROLES} component={ReportsPage} />

        <RoleRoute path="/clients" allow={STAFF_ROLES} component={ClientsListPage} />
        <RoleRoute path="/clients/all" allow={STAFF_ROLES} component={ClientsPage} />
        <RoleRoute path="/clients/:clientId" allow={STAFF_ROLES} component={ClientPage} />
        <RoleRoute path="/clients/:clientId/quotes/:quoteId" allow={STAFF_ROLES} component={QuotePage} />
        <RoleRoute path="/quotes/:quoteId" allow={STAFF_ROLES} component={QuotePage} />
        <RoleRoute path="/clients/:clientId/bookings/:quoteId" allow={STAFF_ROLES} component={BookingPage} />
        <RoleRoute path="/bookings/:quoteId" allow={STAFF_ROLES} component={BookingPage} />
        <RoleRoute path="/clients/:clientId/enquiries/:enquiryId" allow={STAFF_ROLES} component={EnquiryPage} />
        <RoleRoute path="/enquiries/:enquiryId" allow={STAFF_ROLES} component={EnquiryPage} />
        <RoleRoute path="/pipeline" allow={STAFF_ROLES} component={PipelinePage} />
        <RoleRoute path="/opportunities" allow={STAFF_ROLES} component={OpportunitiesPage} />
        <RoleRoute path="/my-profile" allow={STAFF_ROLES} component={MyProfilePage} />
        <RoleRoute path="/chat" allow={STAFF_ROLES} component={ChatPage} />
        <RoleRoute path="/conversations" allow={STAFF_ROLES} component={ConversationsPage} />
        <RoleRoute path="/email" allow={STAFF_ROLES} component={EmailInbox} />
        <RoleRoute path="/destination-guru" allow={STAFF_ROLES} component={DestinationGuruPage} />
        <RoleRoute path="/sms-center" allow={STAFF_ROLES} component={SmsCenterPage} />
        <RoleRoute path="/social-posts" allow={STAFF_ROLES} component={SocialPostsPage} />
        <RoleRoute path="/social-posts/quotes/:quoteId" allow={STAFF_ROLES} component={SocialQuotePage} />
        <RoleRoute path="/social-wall" allow={STAFF_ROLES} component={SocialWallPage} />
        <RoleRoute path="/tickets" allow={STAFF_ROLES} component={TicketsPage} />
        <RoleRoute path="/tickets/:ticketId" allow={STAFF_ROLES} component={TicketsPage} />
        {/* /hub is handled standalone (outside AppLayout) above — TheHUB has its own shell. */}
        <RoleRoute path="/feedback" allow={ALL_ROLES} component={FeedbackPage} />

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AppRouter() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  // On a 401, re-validate the session instead of hard-reloading the page. If the
  // session is gone, useCurrentUser resolves to null and the landing view renders;
  // if the 401 was resource-specific, the user stays put — no reload either way.
  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  if (location === "/portal" || location.startsWith("/portal/")) {
    return (
      <PortalPinGate>
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
      </PortalPinGate>
    );
  }

  if (location === "/travana" || location.startsWith("/travana/")) {
    return <TravanaRouter />;
  }

  if (location === "/cruise-quote-preview") {
    return <CruiseQuotePreviewPage />;
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

  if (location === "/verify-email") {
    return <VerifyEmailPendingPage />;
  }

  if (location === "/accept-invite") {
    return <AcceptInvitePage />;
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

// Runs the single backend session validation and mirrors it into the auth store.
// Rendered once inside QueryClientProvider; renders nothing.
function AuthSync() {
  useAuthSync();
  return null;
}

function App() {
  // Warm the hottest route chunks shortly after first paint so navigating to
  // them doesn't hit a lazy-load (Suspense) spinner. import() is deduped by the
  // bundler, so this just primes the same chunks the lazy() imports use.
  useEffect(() => {
    const t = setTimeout(() => {
      void import("@/pages/agent-overview");
      void import("@/pages/clients");
      void import("@/pages/client");
      void import("@/pages/pipeline");
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthSync />
        <Suspense fallback={<LoadingScreen />}>
          <AppRouter />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;