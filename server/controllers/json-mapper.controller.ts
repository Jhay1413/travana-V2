import { Request, Response } from "express";
import { jsonMapperService } from "../services/json-mapper.service";
import { asyncHandler } from "../utils/async-handler";

export const jsonMapperController = {
  /**
   * POST /api/json-mapper/map-to-ids
   * Maps JSON text values to database IDs
   */
  mapToIds: asyncHandler(async (req: Request, res: Response) => {
    console.log("📥 JSON Mapper Controller - Request received");
    const input = req.body;
    
    const result = await jsonMapperService.mapJsonToIds(input);
    
    console.log("📤 JSON Mapper Controller - Sending response");
    return res.status(200).json({
      success: true,
      data: result,
    });
  }),
};
