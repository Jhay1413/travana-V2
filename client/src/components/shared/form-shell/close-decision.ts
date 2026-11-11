export type CloseDecision = "ignore" | "confirm" | "close";

/** What a close request (X, Cancel, Escape) should do: nothing while busy, ask first when dirty, else close. */
export function decideClose({ preventClose, isDirty }: { preventClose?: boolean; isDirty?: boolean }): CloseDecision {
  if (preventClose) return "ignore";
  return isDirty ? "confirm" : "close";
}
