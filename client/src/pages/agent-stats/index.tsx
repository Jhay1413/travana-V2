import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { AgentProfilePage, isProfileTab, tabFromParam, tabPath } from "@/features/agent-profile";

/** `/agents/:agentId` is the Overview; `/agents/:agentId/:tab` opens another section. */
export default function AgentStatsPage() {
  const [, navigate] = useLocation();
  const [, tabbed] = useRoute("/agents/:agentId/:tab");
  const [, plain] = useRoute("/agents/:agentId");
  const params = tabbed ?? plain;
  const agentId = params?.agentId ?? "";
  const rawTab = tabbed?.tab;
  const unknownTab = rawTab !== undefined && !isProfileTab(rawTab);

  // An unknown section name is the Overview; replace it so Back does not return to the bad address.
  useEffect(() => {
    if (unknownTab && agentId) navigate(tabPath(agentId, "overview"), { replace: true });
  }, [unknownTab, agentId, navigate]);

  return <AgentProfilePage key={agentId} agentId={agentId} tab={tabFromParam(rawTab)} />;
}
