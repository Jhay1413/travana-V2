import { useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { HubShell } from "@/features/hub/components/hub-shell";
import type { HubRole } from "@/data/hub-mock";
import { useRole } from "@/hooks/use-role";
import HubDashboard from "@/features/hub/components/hub-dashboard";
import HubTraining from "@/features/hub/components/hub-training";
import HubAiIntel from "@/features/hub/components/hub-ai-intel";
import HubKnowledge from "@/features/hub/components/hub-knowledge";
import HubNews from "@/features/hub/components/hub-news";
import HubProfiles from "@/features/hub/components/hub-profiles";
import HubAdmin from "@/features/hub/components/hub-admin";
import TrainingAdmin from "@/features/hub/components/admin/training-admin";
import TrainingCourseEditor from "@/features/hub/components/admin/training-course-editor";

function TrainingAdminForbidden() {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-slate-500">Training admin is only accessible to platform administrators.</p>
    </div>
  );
}

export default function HubPage() {
  const [role, setRole] = useState<HubRole>("Senior Agent");
  // Real (not mock) role check — training authoring is gated to the
  // platform_admin org role, independent of the hub's demo role dropdown.
  const { orgRole } = useRole();
  const isPlatformAdmin = orgRole === "platform_admin";

  return (
    <HubShell role={role} onRoleChange={setRole}>
      <Switch>
        <Route path="/hub">
          <Redirect to="/hub/profiles" />
        </Route>
        <Route path="/hub/training" component={HubTraining} />
        <Route path="/hub/training/admin/:courseId">
          {isPlatformAdmin ? <TrainingCourseEditor /> : <TrainingAdminForbidden />}
        </Route>
        <Route path="/hub/training/admin">
          {isPlatformAdmin ? <TrainingAdmin /> : <TrainingAdminForbidden />}
        </Route>
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
