import { Router } from "express";
import type { Request } from "express";
import { quotePublicController } from "./quote-public.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { errorHandler } from "../../middlewares/error.middleware";
import { publicQuoteHeaders } from "../../middlewares/public-quote-headers";
import { shareQuoteSchema } from "./quote-public.validator";

const router = Router();
const TEN_MINUTES = 10 * 60 * 1000;
const tokenKey = (req: Request): string | null => (typeof req.params.token === "string" ? req.params.token : null);

// Per IP (req.ip) and, for the writes, per token as well. Generous for a family passing a link around, tight enough
// to slow anyone guessing tokens or looping the view / share endpoints.
const readLimiter = createRateLimiter({ max: 300, windowMs: TEN_MINUTES });
const viewIpLimiter = createRateLimiter({ max: 60, windowMs: TEN_MINUTES });
const viewTokenLimiter = createRateLimiter({ max: 30, windowMs: TEN_MINUTES, keyFn: tokenKey });
const shareIpLimiter = createRateLimiter({ max: 30, windowMs: TEN_MINUTES });
const shareTokenLimiter = createRateLimiter({ max: 20, windowMs: TEN_MINUTES, keyFn: tokenKey });

router.use(publicQuoteHeaders);

router.get("/:token", readLimiter, quotePublicController.getQuote);
router.post("/:token/view", viewIpLimiter, viewTokenLimiter, quotePublicController.logView);
router.post("/:token/share", shareIpLimiter, shareTokenLimiter, validate(shareQuoteSchema), quotePublicController.logShare);
// There is deliberately no public action endpoint: a customer decides in the signed-in portal.

// Anything else under /api/public/quote is a plain 404 (the app's page catch-all must never answer an API path).
router.use((_req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// server/index.ts mounts this router before the app's own error handler, which only knows the v1 AppError class:
// without this, every AppError / validation error thrown here would come out as a 500.
router.use(errorHandler);

export default router;
