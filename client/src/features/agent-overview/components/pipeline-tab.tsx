import PipelineBoard from "@/features/social/components/boards/pipeline-board";

/**
 * The agent dashboard's Pipeline tab embeds the full standalone pipeline board,
 * locked to the viewing agent. This gives the dashboard the exact same
 * behaviour as the /pipeline page — drag between stages, convert to booking,
 * open the deal detail panel — instead of a read-only preview.
 *
 * `tab` is accepted for call-site compatibility; the tab content is unmounted
 * while inactive, so the board only mounts (and fetches) when this tab is open.
 */
export function PipelineTab({ userId }: { userId: string; tab: string }) {
  if (!userId) return null;
  return <PipelineBoard agentId={userId} embedded />;
}
