import type { Request, Response, NextFunction } from "express";
import { newQuoteService } from "./quote.service";
import type { QuoteChildKind } from "./quote.types";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UUID_FIRST_SEGMENT = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;
// `/:id/flights/:childId` and friends: the child row is judged by the quote that OWNS it, not by the
// :id in the path (a child can be addressed through any quote id).
const CHILD_SEGMENTS: Record<string, QuoteChildKind> = {
  flights: "flight",
  accommodations: "accommodation",
  transfers: "transfer",
  passengers: "passenger",
};
const CHILD_ROUTE = /^\/[0-9a-f-]{36}\/(flights|accommodations|transfers|passengers)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;
// Write routes without a quote id that the social flow needs: creating a social
// (free) quote and presigning its images.
const SOCIAL_CREATE_PATHS = new Set(["/social-post", "/images/presign"]);

/**
 * social_media_manager is read-only on deals but publishes from free (social)
 * quotes. For that role every write is refused unless it targets a free quote
 * (or is one of the social creation endpoints). Every other role passes
 * untouched. Mounted with router.use, so it resolves the quote id from the path
 * (every quote route starts with the quote uuid) and new routes are default-deny
 * for this role. Routes that address a child row (flight, accommodation, transfer,
 * passenger) are additionally judged by the quote that owns the child.
 */
export async function restrictSocialManagerToFreeQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.orgRole !== "social_media_manager" || SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const deny = () => res.status(403).json({ message: "You do not have permission to modify deals" });

  if (req.method === "POST" && SOCIAL_CREATE_PATHS.has(req.path)) {
    next();
    return;
  }
  const id = UUID_FIRST_SEGMENT.exec(req.path)?.[1];
  if (!id) {
    deny();
    return;
  }
  try {
    const orgId = req.orgId || null;
    const free = await newQuoteService.isFreeQuote(id, orgId);
    // A missing quote falls through so the handler answers 404 as before.
    if (free === false) {
      deny();
      return;
    }
    // A child row is judged by its own quote: one that belongs to a deal quote is refused here even
    // when the path names a free quote. A child that does not exist falls through to the 404.
    const child = CHILD_ROUTE.exec(req.path);
    if (child) {
      const childIsFree = await newQuoteService.isFreeQuoteOfChild(CHILD_SEGMENTS[child[1].toLowerCase()], child[2], orgId);
      if (childIsFree === false) {
        deny();
        return;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
