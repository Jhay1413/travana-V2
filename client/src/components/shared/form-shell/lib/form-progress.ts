export interface ProgressSection {
  /** Optional sections never count towards "N of M". */
  optional?: boolean;
  done: boolean;
}

/** Counts required sections: `done` of `total`. Optional sections are ignored. */
export function countDone(sections: readonly ProgressSection[]): { done: number; total: number } {
  const required = sections.filter((s) => !s.optional);
  return { done: required.filter((s) => s.done).length, total: required.length };
}

/** Footer status line: an error count wins over progress. */
export function footerStatus(done: number, total: number, errorCount: number): string {
  if (errorCount > 0) return `${errorCount} ${errorCount === 1 ? "field needs" : "fields need"} attention`;
  return `${done} of ${total} sections complete`;
}
