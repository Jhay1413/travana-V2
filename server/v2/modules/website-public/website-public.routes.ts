import { Router } from "express";
import { publicDealsController } from "./public-deals.controller";

const router = Router();

router.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

router.get("/deals", publicDealsController.getDeals);
router.get("/deals/latest", publicDealsController.getLatestDeals);
router.get("/deals/featured", publicDealsController.getFeaturedDeals);
router.get("/deals/categories", publicDealsController.getCategories);
router.get("/deals/filters", publicDealsController.getDealFilters);
router.get("/deals/:id", publicDealsController.getDealById);

router.get("/destinations", publicDealsController.getAllDestinations);
router.get("/destinations/:name", publicDealsController.getDestinationByName);

router.get("/stats", publicDealsController.getStats);

export default router;
