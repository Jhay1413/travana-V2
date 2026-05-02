import { Router } from "express";
import { walletController } from "../controllers/wallet.controller";

const router = Router();

// Admin: list all wallet transactions
router.get("/", walletController.listAll);

// Admin: get balance for a client
router.get("/client/:clientId/balance", walletController.getBalance);

// Admin: get transaction history for a client
router.get("/client/:clientId/transactions", walletController.getTransactions);

// Admin: apply wallet credit to a booking (creates pending debit)
router.post("/client/:clientId/apply-booking-credit", walletController.applyBookingCredit);

// Admin: confirm a debit was processed (bank transfer sent / credit applied)
router.patch("/transactions/:id/process", walletController.processDebit);

// Admin: reject a debit (returns balance to client)
router.patch("/transactions/:id/reject", walletController.rejectDebit);

export default router;
