import { Request, Response } from "express";
import { taskService } from "../services/task.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/error-handler";
import { insertTaskSchema } from "@shared/schema";

export const taskController = {
  listByEntity: asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
    if (!entityType || !entityId) {
      throw new AppError("entityType and entityId query parameters are required", 400);
    }
    const tasks = await taskService.listByEntity(entityType, entityId);
    return successResponse(res, tasks);
  }),

  listByUser: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      throw new AppError("userId query parameter is required", 400);
    }
    const tasks = await taskService.listByUser(userId);
    return successResponse(res, tasks);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = { ...req.body };
    if (typeof body.dueDate === "string") {
      body.dueDate = new Date(body.dueDate);
    }
    const parsed = insertTaskSchema.parse(body);
    const task = await taskService.create(parsed);
    return successResponse(res, task, "Task created", 201);
  }),

  toggleComplete: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const task = await taskService.toggleComplete(id);
    return successResponse(res, task, "Task updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await taskService.remove(id);
    return successResponse(res, null, "Task deleted");
  }),
};
