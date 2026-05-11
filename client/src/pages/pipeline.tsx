import { useRole } from "@/hooks/use-role";
import PipelineBoard from "@/components/boards/pipeline-board";

export default function PipelinePage() {
  const { role } = useRole();

  return (
    <PipelineBoard />
  );
}
