import { Request, Response } from "express";
import { noteService } from "./note.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";

export const noteController = {
  listByTransactionId: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const transactionId = req.params.transactionId as string;
    const notes = await noteService.listByTransactionId(transactionId, scope);
    return successResponse(res, notes, "Notes retrieved successfully");
  }),

  createNote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const agentId = getUserId(req);
    const note = await noteService.createNote({ ...req.body, agent_id: agentId }, scope);
    return successResponse(res, note, "Note created successfully", 201);
  }),

  updateNote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    const { content } = req.body;
    const note = await noteService.updateNote(id, content, scope);
    return successResponse(res, note, "Note updated successfully");
  }),

  deleteNote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const id = req.params.id as string;
    await noteService.deleteNote(id, scope);
    res.status(204).send();
  }),
};
