import { Request, Response } from "express";
import { newEnquiryService } from "./enquiry.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

export const enquiryController = {
  listEnquiries: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const enquiries = await newEnquiryService.listEnquiries(scope);
    return successResponse(res, enquiries, "Enquiries retrieved successfully");
  }),

  getEnquiryById: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const enquiry = await newEnquiryService.getEnquiryWithRelations(id, scope);
    return successResponse(res, enquiry, "Enquiry retrieved successfully");
  }),

  getEnquiryByTransactionId: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const transactionId = req.params.transactionId as string;
    const enquiry = await newEnquiryService.getEnquiryByTransactionId(transactionId, scope);
    return successResponse(res, enquiry, "Enquiry retrieved successfully");
  }),

  createEnquiry: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const enquiry = await newEnquiryService.createEnquiry(req.body, scope);
    return successResponse(res, enquiry, "Enquiry created successfully", 201);
  }),

  updateEnquiry: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const { destinations, resorts, boardBases, departureAirports, passengers, ...enquiryData } = req.body;
    const relations = { destinations, resorts, boardBases, departureAirports, passengers };
    const enquiry = await newEnquiryService.updateEnquiry(id, enquiryData, relations, scope);
    return successResponse(res, enquiry, "Enquiry updated successfully");
  }),

  deleteEnquiry: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await newEnquiryService.deleteEnquiry(id, scope);
    res.status(204).send();
  }),
};
