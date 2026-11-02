import { AppError } from "./error-handler";

/** Shown when a deal is readable (same organisation) but belongs to a shop the caller is not pinned to. */
export const OTHER_SHOP_MESSAGE = "This deal belongs to another shop";

/**
 * A write was refused by the shop-pinned write scope. If the record is still readable (the org-wide
 * read scope lets the caller see it) it is a same-organisation deal in another shop: 403 with a clear
 * message, which leaks nothing the caller could not already read. If it is not readable either (another
 * organisation, a homeworker's deal, a missing id) it stays a plain 404.
 */
export function refuseDealWrite(readable: boolean, notFoundMessage: string): never {
  if (readable) throw new AppError(OTHER_SHOP_MESSAGE, 403);
  throw new AppError(notFoundMessage, 404);
}
