import { useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { HubShell } from "@/features/hub/components/hub-shell";
import type { HubRole } from "@/data/hub-mock";
import HubDashboard from "@/features/hub/components/hub-dashboard";
import HubTraining from "@/features/hub/components/hub-training";
import HubAiIntel from "@/features/hub/components/hub-ai-intel";
import HubKnowledge from "@/features/hub/components/hub-knowledge";
import HubNews from "@/features/hub/components/hub-news";
import HubProfiles from "@/features/hub/components/hub-profiles";
import HubAdmin from "@/features/hub/components/hub-admin";

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
