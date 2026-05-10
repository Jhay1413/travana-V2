import { Request, Response } from "express";
import { taskService } from "./task.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/error-handler";
import { insertTasksSchema } from "@shared/schema";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";

export const taskController = {
  listAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const tasks = await taskService.listAll(userId || undefined, getScope(req));
    return successResponse(res, tasks);
  }),

  listAllExtended: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const tasks = await taskService.listAllWithClientTasks(userId || undefined, getScope(req));
    return successResponse(res, tasks);
  }),

  listByEntity: asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
    if (!entityType || !entityId) {
      throw new AppError("entityType and entityId query parameters are required", 400);
    }
    const tasks = await taskService.listByEntity(entityType, entityId, getScope(req));
    return successResponse(res, tasks);
  }),

  listByUser: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      throw new AppError("userId query parameter is required", 400);
    }
    const dueFromRaw = req.query.dueFrom as string | undefined;
    const dueToRaw = req.query.dueTo as string | undefined;
    const incompleteRaw = req.query.incomplete as string | undefined;
    const filters = {
      dueFrom: dueFromRaw ? new Date(dueFromRaw) : undefined,
      dueTo: dueToRaw ? new Date(dueToRaw) : undefined,
      incomplete: incompleteRaw === "true" || incompleteRaw === "1",
    };
    const tasks = await taskService.listByUser(userId, getScope(req), filters);
    return successResponse(res, tasks);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = { ...req.body };
    if (typeof body.dueDate === "string") {
      body.dueDate = new Date(body.dueDate);
    }
    const parsed = insertTasksSchema.parse(body);
    const task = await taskService.create(parsed, getScope(req));
    return successResponse(res, task, "Task created", 201);
  }),

  toggleComplete: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const task = await taskService.toggleComplete(id, getScope(req));
    return successResponse(res, task, "Task updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await taskService.remove(id, getScope(req));
    return successResponse(res, null, "Task deleted");
  }),
};
