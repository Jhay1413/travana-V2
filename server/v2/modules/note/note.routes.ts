import { Router } from "express";
import { noteController } from "./note.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createNoteValidator, updateNoteValidator, listByClientValidator } from "./note.validator";
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';

const router = Router();
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.get("/transaction/:transactionId", noteController.listByTransactionId);
router.get("/client/:clientId", validate(listByClientValidator), noteController.listByClientId);
router.post("/", validate(createNoteValidator), noteController.createNote);
router.patch("/:id", validate(updateNoteValidator), noteController.updateNote);
router.delete("/:id", noteController.deleteNote);

export default router;
