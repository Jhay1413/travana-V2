import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import CommandCenterPage from "@/pages/command-center";
import ClientsPage from "@/pages/clients";
import ClientPage from "@/pages/client";
import QuotePage from "@/pages/quote";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CommandCenterPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/:clientId" component={ClientPage} />
      <Route path="/clients/:clientId/quotes/:quoteId" component={QuotePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
