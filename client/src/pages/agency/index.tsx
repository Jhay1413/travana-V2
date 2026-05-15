import { Switch, Route, Redirect } from "wouter";
import AgencyProfilePage from "./profile";
import AgencyBranchesPage from "./branches";
import AgencyBranchDetailPage from "./branch-detail";
import AgencyTeamPage from "./team";
import AgencyBillingPage from "./billing";
import AgencyTargetsPage from "./targets";
import AgencyTemplatesPage from "./templates";
import AgencyDataPage from "./data";
import AgencyAuditPage from "./audit";
import AgencyTourOperatorsPage from "./tour-operators";

export default function AgencyPage() {
  return (
    <Switch>
      <Route path="/agency" component={() => <Redirect to="/agency/profile" />} />
      <Route path="/agency/profile" component={AgencyProfilePage} />
      <Route path="/agency/branding" component={() => <Redirect to="/agency/profile" />} />
      <Route path="/agency/branches" component={AgencyBranchesPage} />
      <Route path="/agency/branches/:branchId" component={AgencyBranchDetailPage} />
      <Route path="/agency/team" component={AgencyTeamPage} />
      <Route path="/agency/billing" component={AgencyBillingPage} />
      <Route path="/agency/targets" component={AgencyTargetsPage} />
      <Route path="/agency/templates" component={AgencyTemplatesPage} />
      <Route path="/agency/data" component={AgencyDataPage} />
      <Route path="/agency/audit" component={AgencyAuditPage} />
      <Route path="/agency/tour-operators" component={AgencyTourOperatorsPage} />
      <Route component={() => <Redirect to="/agency/profile" />} />
    </Switch>
  );
}
