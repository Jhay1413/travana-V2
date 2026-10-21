/**
 * Holiday (transaction) a new-ticket form should start on. A ?transaction= link
 * only means something for the client it came with, so it applies when the
 * client being set is that client, and is dropped for any other client.
 */
export function seededTransactionId(
  clientId: string | null | undefined,
  initialClientId: string | undefined,
  initialTransactionId: string | undefined,
): string {
  if (!clientId || !initialClientId || !initialTransactionId) return "";
  return clientId === initialClientId ? initialTransactionId : "";
}

/** The chosen holiday if it is one of the client's own holidays, else "" so a mismatched id is never submitted. */
export function validTransactionId(transactionId: string, optionIds: readonly string[]): string {
  return transactionId && optionIds.includes(transactionId) ? transactionId : "";
}
