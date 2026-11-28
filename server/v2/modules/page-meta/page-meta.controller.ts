import type { Request } from "express";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { getPortalBaseUrl, getStaffOrigin, hostKind } from "../../utils/hosts";
import { getPublicBaseUrl } from "../../utils/public-url";
import { injectHostsMeta } from "../../utils/index-html";
import { applyPageMeta } from "./page-meta.html";
import { pageMetaService } from "./page-meta.service";

// The same budget as the public quote API's GET (300 per 10 minutes per IP): the page head can never be used to probe
// tokens faster than the API allows. Over the budget the page still loads, with the neutral head and no lookup.
const lookupLimiter = createRateLimiter({ max: 300, windowMs: 10 * 60 * 1000, onLimit: () => undefined });

function lookupAllowed(req: Request): boolean {
  let allowed = false;
  // The limiter only decides here; when it refuses it writes through this stand-in response, which records nothing.
  const quiet = { setHeader: () => undefined };
  lookupLimiter(req, quiet as never, () => {
    allowed = true;
  });
  return allowed;
}

/** The address a logo's relative path is served from: the portal host when there is one, else the site address. */
function logoOrigin(): string {
  return getPortalBaseUrl() ?? getStaffOrigin() ?? getPublicBaseUrl();
}

/**
 * The page the browser receives for any app route: the built index.html with the hosts tag, and for customer-facing pages
 * (the portal host; on a single host only /portal and /view-quote) the neutral page head instead of the platform's own.
 * The staff host keeps today's tags.
 */
export async function renderIndexHtml(template: string, req: Request): Promise<string> {
  const kind = hostKind(req);
  let html = template;
  if (kind !== "staff") {
    const pathname = req.originalUrl.split("?")[0] ?? "/";
    const meta = await pageMetaService.forPath(pathname, { origin: logoOrigin(), lookupAllowed: () => lookupAllowed(req) });
    if (meta) html = applyPageMeta(html, meta);
  }
  return injectHostsMeta(html, req);
}
