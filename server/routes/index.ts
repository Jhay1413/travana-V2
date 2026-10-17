import { Router } from "express";

const router = Router();

// Every legacy v1 router has been UNMOUNTED (files stay on disk, unused). v2 serves the
// same features under /api/v2/* behind isAuthenticated + orgBranchScope. Verified by grep
// that neither client/ nor server/ calls any of these prefixes:
//   /users /clients /quotes /tour-operators /airports /notifications /dashboard /facebook
//   /tickets /attachments /replies /admin /settings /user-profiles /quote-share /audit /ai
// and /wallet (the client portal now reads GET /api/portal/wallet/transactions instead of
// /api/wallet/client/:id/transactions; same service, same rows).
// Public endpoints (quote-public, website-public, portal, facebook webhook) are mounted
// directly in server/index.ts, not here.

export default router;
