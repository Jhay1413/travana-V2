import { LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user } = useAuth();
  const name = user?.firstName || user?.name || "there";

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <LayoutGrid className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Welcome, {name}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Pick a section from the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
