import { Switch, Route, Redirect } from "wouter";
import AgencyProfilePage from "./profile";
import AgencyBranchesPage from "./branches";
import AgencyBranchDetailPage from "./branch-detail";
import AgencyTeamPage from "./team";
import AgencyMessagingPage from "./messaging";
import AgencyBillingPage from "./billing";
import AgencyUsagePage from "./usage";
import AgencyTargetsPage from "./targets";
import AgencyForwardsPage from "./forwards";
import AgencyLeaderboardPage from "./leaderboard";
import AgencyTemplatesPage from "./templates";
import AgencyDataPage from "./data";
import AgencyTextsPage from "./texts";
import AgencyAuditPage from "./audit";
import AgencyTourOperatorsPage from "./tour-operators";
import AgencySupplierScrapersPage from "./supplier-scrapers";

export default function AgencyPage() {
  return (
    <Switch>
      <Route path="/agency" component={() => <Redirect to="/agency/profile" />} />
      <Route path="/agency/profile" component={AgencyProfilePage} />
      <Route path="/agency/branding" component={() => <Redirect to="/agency/profile" />} />
      <Route path="/agency/branches" component={AgencyBranchesPage} />
      <Route path="/agency/branches/:branchId" component={AgencyBranchDetailPage} />
      <Route path="/agency/team" component={AgencyTeamPage} />
      <Route path="/agency/messaging" component={AgencyMessagingPage} />
      <Route path="/agency/billing" component={AgencyBillingPage} />
      <Route path="/agency/usage" component={AgencyUsagePage} />
      <Route path="/agency/targets" component={AgencyTargetsPage} />
      <Route path="/agency/forwards" component={AgencyForwardsPage} />
      <Route path="/agency/leaderboard" component={AgencyLeaderboardPage} />
      <Route path="/agency/templates" component={AgencyTemplatesPage} />
      <Route path="/agency/data" component={AgencyDataPage} />
      <Route path="/agency/texts" component={AgencyTextsPage} />
      <Route path="/agency/audit" component={AgencyAuditPage} />
      <Route path="/agency/tour-operators" component={AgencyTourOperatorsPage} />
      <Route path="/agency/supplier-scrapers" component={AgencySupplierScrapersPage} />
      <Route component={() => <Redirect to="/agency/profile" />} />
    </Switch>
  );
}
