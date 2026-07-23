import { Router } from "express";
import multer from "multer";
import { quoteController } from "./quote.controller";
import { quoteImageController } from "./quote-image.controller";
import { validate } from "../../middlewares/validation.middleware";
import { addImagesValidator, presignQuoteImagesValidator } from "./quote.validator";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only JPEG, PNG, WebP and GIF are accepted.`));
    }
  },
});

// Direct-to-S3 presigned upload for quote images (Option A, single PUT — same
// pattern as training-upload.service.ts). Registered before the "/:id"-style
// routes below so "/images/presign" is never captured as an :id param.
router.post("/images/presign", validate(presignQuoteImagesValidator), quoteImageController.presignUploads);

router.get("/free", quoteController.listFreeQuotes);
router.get("/engagement/recent", quoteController.listRecentClientEngagement);
router.get("/", quoteController.listQuotes);
router.get("/:id", quoteController.getQuoteById);
router.post("/social-post", upload.array("images", 50), quoteController.createSocialQuote);
router.post("/", upload.array("images", 50), quoteController.createQuote);
router.post("/:id/duplicate", quoteController.duplicateQuote);
router.patch("/:id", upload.array("images", 50), quoteController.updateQuote);
router.patch("/:id/primary", quoteController.setPrimaryQuote);
router.delete("/:id", quoteController.deleteQuote);

router.post("/:id/flights", quoteController.addFlight);
router.patch("/:id/flights/:flightId", quoteController.updateFlight);
router.delete("/:id/flights/:flightId", quoteController.removeFlight);

router.post("/:id/accommodations", quoteController.addAccommodation);
router.patch("/:id/accommodations/:accommodationId", quoteController.updateAccommodation);
router.delete("/:id/accommodations/:accommodationId", quoteController.removeAccommodation);

router.post("/:id/transfers", quoteController.addTransfer);
router.delete("/:id/transfers/:transferId", quoteController.removeTransfer);

router.post("/:id/passengers", quoteController.addPassenger);
router.delete("/:id/passengers/:passengerId", quoteController.removePassenger);

router.post("/:quoteId/images/upload", upload.array("images", 50), quoteImageController.uploadImages);
router.post("/:quoteId/images", validate(addImagesValidator), quoteImageController.addImages);
router.get("/:quoteId/images", quoteImageController.getImages);
router.delete("/:quoteId/images/:imageId", quoteImageController.deleteImage);
router.patch("/:quoteId/images/:imageId/primary", quoteImageController.setPrimaryImage);

router.put("/:id/tags", quoteController.updateQuoteTags);
router.get("/:id/tags", quoteController.getQuoteTags);

router.patch("/:id/portal-visibility", quoteController.setPortalVisibility);
router.patch("/:id/featured", quoteController.setFeatured);
router.post("/:id/portal-push", requireOrgRole(["org_admin", "platform_admin"]), quoteController.portalPush);

export default router;
