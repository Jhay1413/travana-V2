import { Router } from "express";
import { enquiryController } from "../controllers/enquiry.controller";
import { enquiryNoteController } from "../controllers/enquiryNote.controller";
import { validate } from "../middlewares/validation.middleware";
import { createEnquiryValidator, updateEnquiryValidator } from "../validators/enquiry.validator";
import { createEnquiryNoteValidator, updateEnquiryNoteValidator } from "../validators/enquiryNote.validator";

const router = Router();

router.get("/", enquiryController.listEnquiries);
router.get("/:id", enquiryController.getEnquiryById);
router.post("/", validate(createEnquiryValidator), enquiryController.createEnquiry);
router.patch("/:id", validate(updateEnquiryValidator), enquiryController.updateEnquiry);
router.delete("/:id", enquiryController.deleteEnquiry);

router.get("/:enquiryId/notes", enquiryNoteController.listByEnquiryId);
router.post("/:enquiryId/notes", validate(createEnquiryNoteValidator), enquiryNoteController.createNote);
router.patch("/:enquiryId/notes/:id", validate(updateEnquiryNoteValidator), enquiryNoteController.updateNote);
router.delete("/:enquiryId/notes/:id", enquiryNoteController.deleteNote);

export default router;
