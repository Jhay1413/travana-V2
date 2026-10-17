import type { Request, Response, NextFunction } from "express";
import { newQuoteService } from "./quote.service";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UUID_FIRST_SEGMENT = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;
// Write routes without a quote id that the social flow needs: creating a social
// (free) quote and presigning its images.
const SOCIAL_CREATE_PATHS = new Set(["/social-post", "/images/presign"]);

/**
 * social_media_manager is read-only on deals but publishes from free (social)
 * quotes. For that role every write is refused unless it targets a free quote
 * (or is one of the social creation endpoints). Every other role passes
 * untouched. Mounted with router.use, so it resolves the quote id from the path
 * (every quote route starts with the quote uuid) and new routes are default-deny
 * for this role.
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
    const free = await newQuoteService.isFreeQuote(id);
    // A missing quote falls through so the handler answers 404 as before.
    if (free === false) {
      deny();
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
