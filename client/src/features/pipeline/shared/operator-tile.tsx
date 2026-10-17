import { useState } from "react";
import { cn } from "@/lib/utils";

/** Short code for a tour operator tile: a short single word stays whole ("TUI"),
 *  a long one keeps its first three letters ("Jet2holidays" -> "JET"), and
 *  multi-word names use up to three initials ("P&O Cruises" -> "PC"). */
export function operatorCode(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return trimmed.length <= 4 ? trimmed.toUpperCase() : trimmed.slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Rounded tile showing the operator logo, or its short code when there is none. */
export function OperatorTile({
  name,
  logoUrl,
  size = 34,
  className,
}: {
  name: string | null;
  logoUrl: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!name && !logoUrl) return null;
  const box = { width: size, height: size };
  const base = "grid shrink-0 place-items-center overflow-hidden rounded-[9px] border border-[#D5DCE6] bg-[#F8FAFC] dark:border-border dark:bg-muted";
  if (logoUrl && !failed) {
    return (
      <span className={cn(base, className)} style={box} title={name ? `Tour operator: ${name}` : undefined}>
        <img src={logoUrl} alt={name || "Tour operator"} onError={() => setFailed(true)} className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }
  return (
    <span
      className={cn(base, "font-bold tracking-tight text-[#1F2D44] dark:text-foreground", size >= 30 ? "text-[11px]" : "text-[10px]", className)}
      style={box}
      title={name ? `Tour operator: ${name}` : undefined}
      aria-label={name ? `Tour operator: ${name}` : undefined}
    >
      {operatorCode(name)}
    </span>
  );
}
