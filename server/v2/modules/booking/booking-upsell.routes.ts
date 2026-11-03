import { Router } from "express";
import { bookingUpsellController } from "./booking-upsell.controller";
import { validate } from "../../middlewares/validation.middleware";
import { updateUpsellValidator, removeUpsellValidator } from "./booking-upsell.validator";

// Top-level upsell routes (mounted at `/upsells`). The booking-scoped
// list/create routes live in booking.routes.ts under `/bookings/:bookingId/upsells`.
// Update/delete are addressed by upsell id directly so `added_at` stays immutable
// from booking edits.
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';

const router = Router();
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.patch("/:id", validate(updateUpsellValidator), bookingUpsellController.update);
router.delete("/:id", validate(removeUpsellValidator), bookingUpsellController.remove);

export default router;
