import { Router } from "express";
import { transactionController } from "../controllers/transaction.controller";

const router = Router();

router.get("/", transactionController.listTransactions);
router.get("/pipeline", transactionController.listTransactionsLightweight);
router.get("/stats", transactionController.getStats);
router.get("/:id", transactionController.getTransactionById);
router.post("/", transactionController.createTransaction);
router.patch("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

export default router;
