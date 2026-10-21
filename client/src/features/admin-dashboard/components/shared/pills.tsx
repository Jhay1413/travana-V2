export { StatusPill } from "@/components/shared/status-pill";
export type { PillTone } from "@/components/shared/status-pill";

/** Muted marker for cards that show prototype sample content rather than live data. */
export function SamplePill() {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full border border-dashed border-social-border bg-muted px-2.5 text-[11px] font-semibold text-social-muted"
      data-testid="pill-sample"
    >
      Sample
    </span>
  );
}
