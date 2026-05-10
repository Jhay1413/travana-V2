import { Switch, Route, Redirect } from "wouter";
import AgencyProfilePage from "./profile";
import AgencyBranchesPage from "./branches";
import AgencyTeamPage from "./team";
import AgencyBillingPage from "./billing";

export default function AgencyPage() {
  return (
    <Switch>
      <Route path="/agency" component={() => <Redirect to="/agency/profile" />} />
      <Route path="/agency/profile" component={AgencyProfilePage} />
      <Route path="/agency/branding" component={() => <Redirect to="/agency/profile" />} />
      <Route path="/agency/branches" component={AgencyBranchesPage} />
      <Route path="/agency/team" component={AgencyTeamPage} />
      <Route path="/agency/billing" component={AgencyBillingPage} />
      <Route component={() => <Redirect to="/agency/profile" />} />
    </Switch>
  );
}
