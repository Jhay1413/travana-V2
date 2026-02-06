import { Router } from "express";
import { noteController } from "../controllers/note.controller";
import { validate } from "../middlewares/validation.middleware";
import { createNoteValidator, updateNoteValidator } from "../validators/note.validator";

const router = Router();

router.get("/quote/:quoteId", noteController.listByQuoteId);
router.post("/", validate(createNoteValidator), noteController.createNote);
router.patch("/:id", validate(updateNoteValidator), noteController.updateNote);
router.delete("/:id", noteController.deleteNote);

export default router;
