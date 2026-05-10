import { LayoutGrid } from "lucide-react";

export default function AgentOverviewPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <LayoutGrid className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Agent Overview</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your personal pipeline summary — coming soon.
        </p>
      </div>
    </div>
  );
}
