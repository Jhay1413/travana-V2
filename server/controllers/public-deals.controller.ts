import { Request, Response } from "express";
import { publicDealsService } from "../services/public-deals.service";
import { asyncHandler } from "../utils/async-handler";
import { successResponse, errorResponse } from "../utils/response";

export const publicDealsController = {
  getDeals: asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = (req.query.sort as string) || "newest";
    const category = (req.query.category as string || "").trim();
    const countryParam = req.query.country;
    const countries = Array.isArray(countryParam)
      ? (countryParam as string[]).map((c) => c.trim()).filter(Boolean)
      : countryParam ? (countryParam as string).split(",").map((c) => c.trim()).filter(Boolean)
      : undefined;

    const tagsParam = req.query.tags;
    const tags = Array.isArray(tagsParam)
      ? (tagsParam as string[]).map((t) => t.trim()).filter(Boolean)
      : tagsParam ? (tagsParam as string).split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;

    const validSorts = ["newest", "price_asc", "price_desc"];
    if (!validSorts.includes(sortBy)) {
      return errorResponse(res, "Invalid sort parameter", 400);
    }

    const result = await publicDealsService.getDeals({
      page,
      limit,
      sortBy: sortBy as "newest" | "price_asc" | "price_desc",
      category: category || undefined,
      countries,
      tags,
    });

    return successResponse(res, result);
  }),

  getLatestDeals: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 8));
    const deals = await publicDealsService.getLatestDeals(limit);
    return successResponse(res, { deals });
  }),

  getFeaturedDeals: asyncHandler(async (_req: Request, res: Response) => {
    const deals = await publicDealsService.getFeaturedDeals();
    return successResponse(res, { deals });
  }),

  getCategories: asyncHandler(async (_req: Request, res: Response) => {
    const data = await publicDealsService.getCategories();
    return successResponse(res, data);
  }),

  getDealById: asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const deal = await publicDealsService.getDealById(req.params.id);
    if (!deal) return errorResponse(res, "Deal not found", 404);
    return successResponse(res, deal);
  }),

  getAllDestinations: asyncHandler(async (_req: Request, res: Response) => {
    const destinations = await publicDealsService.getAllDestinations();
    return successResponse(res, destinations);
  }),

  getDestinationByName: asyncHandler(async (req: Request<{ name: string }>, res: Response) => {
    const name = decodeURIComponent(req.params.name);
    const guru = await publicDealsService.getDestinationByName(name);
    if (!guru) return errorResponse(res, "Destination not found", 404);

    const { deals } = await publicDealsService.getDeals({ limit: 20, sortBy: "newest" });
    return successResponse(res, { destination: guru.destination, country: guru.country, guru: guru.data, deals });
  }),

  getDealFilters: asyncHandler(async (_req: Request, res: Response) => {
    const filters = await publicDealsService.getDealFilters();
    return successResponse(res, filters);
  }),

  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await publicDealsService.getStats();
    return successResponse(res, stats);
  }),
};
