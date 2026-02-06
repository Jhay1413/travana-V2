import { Request, Response } from "express";
import { enquiryService } from "../services/enquiry.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const enquiryController = {
  listEnquiries: asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.query;
    let enquiries;

    if (clientId && typeof clientId === "string") {
      enquiries = await enquiryService.listEnquiriesByClient(clientId);
    } else {
      enquiries = await enquiryService.listEnquiries();
    }

    return successResponse(res, enquiries, "Enquiries retrieved successfully");
  }),

  getEnquiryById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const enquiry = await enquiryService.getEnquiryById(id);
    return successResponse(res, enquiry, "Enquiry retrieved successfully");
  }),

  createEnquiry: asyncHandler(async (req: Request, res: Response) => {
    const enquiry = await enquiryService.createEnquiry(req.body);
    return successResponse(res, enquiry, "Enquiry created successfully", 201);
  }),

  updateEnquiry: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const enquiry = await enquiryService.updateEnquiry(id, req.body);
    return successResponse(res, enquiry, "Enquiry updated successfully");
  }),

  deleteEnquiry: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await enquiryService.deleteEnquiry(id);
    res.status(204).send();
  }),
};
