import { useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { HubShell } from "@/features/hub/components/hub-shell";
import type { HubRole } from "@/data/hub-mock";
import HubDashboard from "./hub-dashboard";
import HubTraining from "./hub-training";
import HubAiIntel from "./hub-ai-intel";
import HubKnowledge from "./hub-knowledge";
import HubDeals from "./hub-deals";
import HubNews from "./hub-news";
import HubProfiles from "./hub-profiles";
import HubAdmin from "./hub-admin";

export default function HubPage() {
  const [role, setRole] = useState<HubRole>("Senior Agent");

  return (
    <HubShell role={role} onRoleChange={setRole}>
      <Switch>
        <Route path="/hub">
          <Redirect to="/hub/profiles" />
        </Route>
        <Route path="/hub/training" component={HubTraining} />
        <Route path="/hub/ai-intel" component={HubAiIntel} />
        <Route path="/hub/knowledge" component={HubKnowledge} />
        <Route path="/hub/deals" component={HubDeals} />
        <Route path="/hub/news">
          <HubNews role={role} />
        </Route>
        <Route path="/hub/profiles" component={HubProfiles} />
        <Route path="/hub/admin">
          {role === "Owner" ? <HubAdmin /> : (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">Admin panel is only accessible to Owners.</p>
            </div>
          )}
        </Route>
        <Route>
          <Redirect to="/hub/profiles" />
        </Route>
      </Switch>
    </HubShell>
  );
}
