import { Router } from "express";
import { publicDealsController } from "../controllers/public-deals.controller";

const websitePublicRouter = Router();

websitePublicRouter.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

websitePublicRouter.get("/deals", publicDealsController.getDeals);
websitePublicRouter.get("/deals/latest", publicDealsController.getLatestDeals);
websitePublicRouter.get("/deals/featured", publicDealsController.getFeaturedDeals);
websitePublicRouter.get("/deals/categories", publicDealsController.getCategories);
websitePublicRouter.get("/deals/filters", publicDealsController.getDealFilters);
websitePublicRouter.get("/deals/:id", publicDealsController.getDealById);

websitePublicRouter.get("/destinations", publicDealsController.getAllDestinations);
websitePublicRouter.get("/destinations/:name", publicDealsController.getDestinationByName);

websitePublicRouter.get("/stats", publicDealsController.getStats);

export default websitePublicRouter;
