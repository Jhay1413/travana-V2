import { useRole } from "@/hooks/use-role";
import { CommandCenterShell } from "@/components/command-center-shell";
import PipelineBoard from "@/components/pipeline-board";

export default function PipelinePage() {
  const { role, setRole } = useRole();

  return (
    <CommandCenterShell
      active="pipeline"
      title="Pipeline"
      subtitle="Lets GO!"
      role={role}
      onRoleChange={setRole}
    >
      <PipelineBoard />
    </CommandCenterShell>
  );
}
