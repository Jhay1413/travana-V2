import { AlertCircle } from "lucide-react";

export function OwnerOnlyGate({ description }: { description?: string }) {
  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
      <div className="font-semibold">Owner access only</div>
      {description && (
        <div className="text-sm text-black/60 dark:text-white/60">{description}</div>
      )}
    </div>
  );
}
