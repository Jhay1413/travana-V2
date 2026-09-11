import { Router } from "express";
import multer from "multer";
import { transactionController } from "./transaction.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/", transactionController.listTransactions);
router.get("/pipeline", transactionController.listTransactionsLightweight);
router.get("/pipeline/:status", transactionController.listPipelineByStatus);
router.get("/expiring-quotes", transactionController.getExpiringQuotes);
router.get("/stats", transactionController.getStats);
// Alias: the bare-id route already returns the enriched transaction (enquiry,
// quotes, booking); this name makes that explicit for callers that need it.
router.get("/:id/details", transactionController.getTransactionById);
router.get("/:id", transactionController.getTransactionById);
router.post("/", upload.array("images", 10), transactionController.createTransaction);
router.patch("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

export default router;
