import { Router } from 'express';
import { walletController } from './wallet.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

const router = Router();

// All wallet routes are admin-only and scoped to the caller's org.
router.use(isAuthenticated, orgBranchScope, requireOrgRole(['org_admin', 'platform_admin', 'branch_manager']));

// List all wallet transactions in caller's org
router.get('/', walletController.listAll);

// Balance + transaction history for a client (org-checked)
router.get('/client/:clientId/balance', walletController.getBalance);
router.get('/client/:clientId/transactions', walletController.getTransactions);

// Apply wallet credit to a booking — creates a pending debit (org-checked)
router.post('/client/:clientId/apply-booking-credit', walletController.applyBookingCredit);

// Process / reject a debit (org-checked via tx → client → org)
router.patch('/transactions/:id/process', walletController.processDebit);
router.patch('/transactions/:id/reject', walletController.rejectDebit);

// Presigned invoice URL for a processed debit (org-checked)
router.get('/transactions/:id/invoice', walletController.getInvoiceUrl);

export default router;
