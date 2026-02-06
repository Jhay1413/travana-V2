import { Request, Response } from "express";
import { enquiryNoteService } from "../services/enquiryNote.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const enquiryNoteController = {
  listByEnquiryId: asyncHandler(async (req: Request, res: Response) => {
    const enquiryId = req.params.enquiryId as string;
    const notes = await enquiryNoteService.listByEnquiryId(enquiryId);
    return successResponse(res, notes, "Enquiry notes retrieved successfully");
  }),

  createNote: asyncHandler(async (req: Request, res: Response) => {
    const note = await enquiryNoteService.createNote(req.body);
    return successResponse(res, note, "Enquiry note created successfully", 201);
  }),

  updateNote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { content } = req.body;
    const note = await enquiryNoteService.updateNote(id, content);
    return successResponse(res, note, "Enquiry note updated successfully");
  }),

  deleteNote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await enquiryNoteService.deleteNote(id);
    res.status(204).send();
  }),
};
