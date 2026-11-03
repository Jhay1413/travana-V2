/** Empty list, empty search, or a failed load (title + one line of help). */
export function OperatorsEmpty({ kind, message, forbidden }: { kind: "none" | "search" | "blocked"; message?: string; forbidden?: boolean }) {
  const copy =
    kind === "search"
      ? { title: "No tour operators match", hint: "Try another name, phone number or website." }
      : kind === "blocked"
        ? { title: message ?? "Couldn't load tour operators", hint: forbidden ? "Open an agency to manage its tour operators." : "Please try again in a moment." }
        : { title: "No tour operators yet", hint: "Add one, or upload a CSV." };
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center text-[13px] text-social-muted" data-testid={`operators-empty-${kind}`}>
      <b className="text-[14px] font-semibold text-foreground">{copy.title}</b>
      <span>{copy.hint}</span>
    </div>
  );
}
