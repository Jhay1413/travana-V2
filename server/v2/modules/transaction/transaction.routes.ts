import { Router } from "express";
import multer from "multer";
import { transactionController } from "./transaction.controller";
import { validate } from "../../middlewares/validation.middleware";
import { updatePriorityValidator, setFutureDealValidator, setLostValidator } from "./transaction.validator";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/", transactionController.listTransactions);
router.get("/pipeline", transactionController.listTransactionsLightweight);
router.get("/pipeline/:status", transactionController.listPipelineByStatus);
router.get("/expiring-quotes", transactionController.getExpiringQuotes);
router.get("/stats", transactionController.getStats);
// Registered before the generic /:id routes below so these specific-path
// segments aren't swallowed by the bare-id matcher.
router.patch("/:id/priority", validate(updatePriorityValidator), transactionController.updatePriority);
router.post("/:id/future", validate(setFutureDealValidator), transactionController.setFutureDeal);
router.post("/:id/lost", validate(setLostValidator), transactionController.setLost);
// Alias: the bare-id route already returns the enriched transaction (enquiry,
// quotes, booking); this name makes that explicit for callers that need it.
router.get("/:id/details", transactionController.getTransactionById);
router.get("/:id", transactionController.getTransactionById);
router.post("/", upload.array("images", 10), transactionController.createTransaction);
router.patch("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

export default router;
