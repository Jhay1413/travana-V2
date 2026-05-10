import { useRole } from "@/hooks/use-role";
import PipelineBoard from "@/components/pipeline-board";

export default function PipelinePage() {
  const { role, setRole } = useRole();

  return (
    <PipelineBoard />
  );
}
