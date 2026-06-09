import { Router } from "express";
import { noteController } from "./note.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createNoteValidator, updateNoteValidator } from "./note.validator";

const router = Router();

router.get("/transaction/:transactionId", noteController.listByTransactionId);
router.get("/client/:clientId", noteController.listByClientId);
router.post("/", validate(createNoteValidator), noteController.createNote);
router.patch("/:id", validate(updateNoteValidator), noteController.updateNote);
router.delete("/:id", noteController.deleteNote);

export default router;
