import { BadgePoundSterling, ShieldCheck, Tag, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { kindMeta } from "../../lib/ticket-display";

const ICONS: Record<string, LucideIcon> = { Sales: BadgePoundSterling, Admin: ShieldCheck, Build: Wrench };

export function KindIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[kindMeta(type).key] ?? Tag;
  return <Icon className={className ?? "h-3 w-3"} />;
}

/** Coloured kind tag (Sales / Admin / Build) with its icon. */
export function KindTag({ type, className }: { type: string; className?: string }) {
  const meta = kindMeta(type);
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-[2px] text-[11.5px] font-semibold", meta.className, className)}
      data-testid="ticket-kind-tag"
    >
      <KindIcon type={type} />
      {meta.label}
    </span>
  );
}

/** Quiet kind label for list rows: grey icon plus text. */
export function KindInline({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <KindIcon type={type} className="h-3 w-3 text-social-muted" />
      {kindMeta(type).label}
    </span>
  );
}
