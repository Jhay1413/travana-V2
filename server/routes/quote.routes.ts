import { Router, Request, Response } from "express";
import multer from "multer";
import { quoteController } from "../controllers/quote.controller";
import { quoteImageController } from "../controllers/quote-image.controller";
import { validate } from "../middlewares/validation.middleware";
import { addImagesValidator } from "../validators/quote-image.validator";
import { db } from "../config/database";
import { quote } from "@shared/schema";
import { eq } from "drizzle-orm";
import { pushNotificationService } from "../services/push-notification.service";

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

router.get("/free", quoteController.listFreeQuotes);
router.get("/", quoteController.listQuotes);
router.get("/:id", quoteController.getQuoteById);
router.post("/social-post", upload.array("images", 10), quoteController.createSocialQuote);
router.post("/", upload.array("images", 10), quoteController.createQuote);
router.post("/:id/duplicate", quoteController.duplicateQuote);
router.patch("/:id", quoteController.updateQuote);
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

router.post("/:quoteId/images/upload", upload.array("images", 10), quoteImageController.uploadImages);
router.post("/:quoteId/images", validate(addImagesValidator), quoteImageController.addImages);
router.get("/:quoteId/images", quoteImageController.getImages);
router.delete("/:quoteId/images/:imageId", quoteImageController.deleteImage);
router.patch("/:quoteId/images/:imageId/primary", quoteImageController.setPrimaryImage);

// Tag management
router.put("/:id/tags", quoteController.updateQuoteTags);
router.get("/:id/tags", quoteController.getQuoteTags);

router.patch("/:id/portal-visibility", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { show_on_portal } = req.body;
    const updates: Record<string, any> = { show_on_portal: !!show_on_portal };

    if (show_on_portal) {
      const [existing] = await db.select({ token: quote.quote_token }).from(quote).where(eq(quote.id, id)).limit(1);
      if (!existing?.token) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let token = "";
        for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
        updates.quote_token = token;
      }
    }

    await db.update(quote).set(updates).where(eq(quote.id, id));
    res.json({ success: true, show_on_portal: !!show_on_portal });
  } catch (err: any) {
    console.error("Portal visibility toggle error:", err);
    res.status(500).json({ error: "Failed to update portal visibility" });
  }
});

router.patch("/:id/featured", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_featured } = req.body;
    await db.update(quote).set({ is_featured: !!is_featured }).where(eq(quote.id, id));
    res.json({ success: true, is_featured: !!is_featured });
  } catch (err: any) {
    console.error("Featured toggle error:", err);
    res.status(500).json({ error: "Failed to update featured status" });
  }
});

router.post("/:id/portal-push", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [q] = await db.select({ title: quote.title, show_on_portal: quote.show_on_portal }).from(quote).where(eq(quote.id, id)).limit(1);
    if (!q) return res.status(404).json({ error: "Quote not found" });

    const sent = await pushNotificationService.sendToAll({
      title: "Latest Holiday Deals from Tinas Travel",
      body: q.title || "Check out our latest travel deal!",
      url: "/portal",
    });

    res.json({ success: true, sent });
  } catch (err: any) {
    console.error("Portal push broadcast error:", err);
    res.status(500).json({ error: "Failed to send push notifications" });
  }
});

export default router;
