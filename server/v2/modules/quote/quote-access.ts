import { newQuoteRepository } from "./quote.repository";
import { AppError } from "../../utils/error-handler";
import { refuseDealWrite } from "../../utils/deal-access";
import type { ScopeOrTrusted } from "../../utils/scope-conditions";

/** Record (read) scope: 404 when the quote is outside the caller's organisation or partition. */
export async function assertQuoteReadable(id: string, scope: ScopeOrTrusted): Promise<void> {
  if (!(await newQuoteRepository.quoteInScope(id, scope))) throw new AppError("Quote not found", 404);
}

/** Shop-pinned write scope: 403 for another shop's deal in the same organisation, 404 otherwise. */
export async function assertQuoteWritable(id: string, scope: ScopeOrTrusted): Promise<void> {
  if (await newQuoteRepository.quoteInScopeForWrite(id, scope)) return;
  refuseDealWrite(await newQuoteRepository.quoteInScope(id, scope), "Quote not found");
}

/** Same as assertQuoteWritable, for adding a quote to a deal. */
export async function assertQuoteDealWritable(transactionId: string, scope: ScopeOrTrusted): Promise<void> {
  if (await newQuoteRepository.transactionInScopeForWrite(transactionId, scope)) return;
  refuseDealWrite(await newQuoteRepository.transactionInScope(transactionId, scope), "Quote not found");
}
