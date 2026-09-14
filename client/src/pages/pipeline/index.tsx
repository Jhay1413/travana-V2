import { useRole } from "@/hooks/use-role";
import { PipelineBoard } from "@/features/pipeline";

export default function PipelinePage() {
  const { role } = useRole();

  return (
    <PipelineBoard />
  );
}
