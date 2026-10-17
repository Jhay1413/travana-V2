export interface BulkSummary {
  ok: number;
  failed: number;
  title: string;
  destructive: boolean;
}

function plural(n: number): string {
  return `${n} ticket${n === 1 ? "" : "s"}`;
}

/** Toast copy for a bulk action from Promise.allSettled results. */
export function summarizeBulk(results: ReadonlyArray<{ status: "fulfilled" | "rejected" }>, verb: string): BulkSummary {
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - ok;
  if (failed === 0) return { ok, failed, title: `${plural(ok)} ${verb}`, destructive: false };
  if (ok === 0) return { ok, failed, title: `Couldn't update ${plural(failed)}`, destructive: true };
  return { ok, failed, title: `${plural(ok)} ${verb}, ${failed} failed`, destructive: true };
}
