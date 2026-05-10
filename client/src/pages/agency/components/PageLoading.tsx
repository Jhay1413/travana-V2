import { Loader2 } from "lucide-react";

export function PageLoading({ size = "default" }: { size?: "default" | "small" }) {
  const height = size === "small" ? "h-40" : "h-64";
  return (
    <div className={`grid place-items-center ${height}`}>
      <Loader2 className="h-5 w-5 animate-spin text-black/40 dark:text-white/40" />
    </div>
  );
}
