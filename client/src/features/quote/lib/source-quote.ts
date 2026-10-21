/**
 * Body fragment for "Copy to client": names the quote being copied so the server keeps that
 * quote's tour operators allowed even when the agency has removed them from its list.
 */
export function sourceQuoteField(sourceQuoteId: string | null | undefined): { source_quote_id?: string } {
  return sourceQuoteId ? { source_quote_id: sourceQuoteId } : {};
}
