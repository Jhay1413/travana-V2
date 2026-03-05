import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import CommandCenterPage from "@/pages/command-center";
import ClientsPage from "@/pages/clients";
import ClientPage from "@/pages/client";
import QuotePage from "@/pages/quote"; // Using original full-featured version
import EnquiryPage from "@/pages/enquiry";
import TicketsPage from "@/pages/tickets";
import TicketPage from "@/pages/ticket";
import AdminImportPage from "@/pages/admin-import";
import AdminLookupPage from "@/pages/admin-lookup";
import SettingsLookupPage from "@/pages/settings-lookup";
import BookingPage from "@/pages/booking-standalone";
import PipelinePage from "@/pages/pipeline";
import HubPage from "@/pages/hub";
import SocialPostsPage from "@/pages/social-posts";
import SocialQuotePage from "@/pages/social-quote";
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
  return (
    <Switch>
      <Route path="/" component={CommandCenterPage} />
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
      <Route path="/social-posts" component={SocialPostsPage} />
      <Route path="/social-posts/quotes/:quoteId" component={SocialQuotePage} />
      <Route path="/tickets" component={TicketsPage} />
      <Route path="/tickets/:ticketId" component={TicketPage} />
      <Route path="/hub/:rest*" component={HubPage} />
      <Route path="/hub" component={HubPage} />
      <Route path="/admin/import" component={AdminImportPage} />
      <Route path="/admin/lookup/:tableSlug" component={AdminLookupPage} />
      <Route path="/settings/:tableSlug" component={SettingsLookupPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedRouter />;
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
