import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";
import { hrService } from "./hr.service";
import {
  addDocumentBodySchema,
  addNoteBodySchema,
  inviteEmployeeBodySchema,
  requestLeaveBodySchema,
  updateEmployeeBodySchema,
} from "./hr.validator";

export const hrController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const rows = await hrService.list(getScope(req));
    res.json(rows);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const detail = await hrService.get(req.params.userId as string, getScope(req));
    res.json(detail);
  }),

  reminders: asyncHandler(async (req: Request, res: Response) => {
    const reminders = await hrService.reminders(getScope(req));
    res.json(reminders);
  }),

  invite: asyncHandler(async (req: Request, res: Response) => {
    const body = inviteEmployeeBodySchema.parse(req.body);
    const result = await hrService.invite(body, getScope(req));
    res.status(201).json(result);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const body = updateEmployeeBodySchema.parse(req.body);
    const updated = await hrService.update(req.params.userId as string, body, getScope(req));
    res.json(updated);
  }),

  requestLeave: asyncHandler(async (req: Request, res: Response) => {
    const body = requestLeaveBodySchema.parse(req.body);
    const updated = await hrService.requestLeave(req.params.userId as string, body, getScope(req));
    res.status(201).json(updated);
  }),

  approveLeave: asyncHandler(async (req: Request, res: Response) => {
    const updated = await hrService.decideLeave(
      req.params.userId as string,
      req.params.leaveId as string,
      "Approved",
      getScope(req),
    );
    res.json(updated);
  }),

  rejectLeave: asyncHandler(async (req: Request, res: Response) => {
    const updated = await hrService.decideLeave(
      req.params.userId as string,
      req.params.leaveId as string,
      "Rejected",
      getScope(req),
    );
    res.json(updated);
  }),

  addNote: asyncHandler(async (req: Request, res: Response) => {
    const body = addNoteBodySchema.parse(req.body);
    const updated = await hrService.addNote(req.params.userId as string, body, getScope(req));
    res.status(201).json(updated);
  }),

  addDocument: asyncHandler(async (req: Request, res: Response) => {
    const body = addDocumentBodySchema.parse(req.body);
    const updated = await hrService.addDocument(req.params.userId as string, body, getScope(req));
    res.status(201).json(updated);
  }),

  uploadDocumentFile: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file provided" });
    const displayName = typeof req.body?.name === "string" ? req.body.name : undefined;
    const updated = await hrService.uploadDocumentFile(
      req.params.userId as string,
      file,
      getScope(req),
      displayName,
    );
    res.status(201).json(updated);
  }),

  downloadDocument: asyncHandler(async (req: Request, res: Response) => {
    const url = await hrService.getDocumentDownloadUrl(
      req.params.userId as string,
      req.params.docId as string,
      getScope(req),
    );
    res.redirect(url);
  }),

  deleteDocument: asyncHandler(async (req: Request, res: Response) => {
    const updated = await hrService.deleteDocument(
      req.params.userId as string,
      req.params.docId as string,
      getScope(req),
    );
    res.json(updated);
  }),

  // ── Self-service: any authenticated org member can use these for their own record.

  getMe: asyncHandler(async (req: Request, res: Response) => {
    const detail = await hrService.getMyRecord(getScope(req));
    res.json(detail);
  }),

  requestMyLeave: asyncHandler(async (req: Request, res: Response) => {
    const body = requestLeaveBodySchema.parse(req.body);
    const updated = await hrService.requestMyLeave(body, getScope(req));
    res.status(201).json(updated);
  }),
};
