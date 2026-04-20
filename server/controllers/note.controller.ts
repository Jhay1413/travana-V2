import { Request, Response } from "express";
import { noteService } from "../services/note.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { getUserId } from "../utils/get-user-id";

export const noteController = {
  listByTransactionId: asyncHandler(async (req: Request, res: Response) => {
    const transactionId = req.params.transactionId as string;
    const notes = await noteService.listByTransactionId(transactionId);
    return successResponse(res, notes, "Notes retrieved successfully");
  }),

  createNote: asyncHandler(async (req: Request, res: Response) => {
    const agentId = getUserId(req);
    const note = await noteService.createNote({ ...req.body, agent_id: agentId });
    return successResponse(res, note, "Note created successfully", 201);
  }),

  updateNote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { content } = req.body;
    const note = await noteService.updateNote(id, content);
    return successResponse(res, note, "Note updated successfully");
  }),

  deleteNote: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await noteService.deleteNote(id);
    res.status(204).send();
  }),
};
