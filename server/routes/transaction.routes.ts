import { Router } from "express";
import multer from "multer";
import { transactionController } from "../controllers/transaction.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/", transactionController.listTransactions);
router.get("/pipeline", transactionController.listTransactionsLightweight);
router.get("/pipeline/:status", transactionController.listPipelineByStatus);
router.get("/expiring-quotes", transactionController.getExpiringQuotes);
router.get("/stats", transactionController.getStats);
router.get("/:id", transactionController.getTransactionById);
router.post("/", upload.array("images", 10), transactionController.createTransaction);
router.patch("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

export default router;
