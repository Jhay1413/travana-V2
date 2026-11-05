/** Ids of soft-deleted clients among the rows the pipeline loaded, for the row's client_deleted flag. */
export function deletedClientIds(rows: ReadonlyArray<{ id: string; deletedAt?: Date | null }>): Set<string> {
  return new Set(rows.filter((r) => !!r.deletedAt).map((r) => r.id));
}
