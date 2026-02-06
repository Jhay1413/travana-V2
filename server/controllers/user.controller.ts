import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const userController = {
  listUsers: asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.listUsers();
    return successResponse(res, users, "Users retrieved successfully");
  }),

  getUserById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await userService.getUserById(id);
    return successResponse(res, user, "User retrieved successfully");
  }),

  createUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body);
    return successResponse(res, user, "User created successfully", 201);
  }),

  updateUser: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await userService.updateUser(id, req.body);
    return successResponse(res, user, "User updated successfully");
  }),

  deleteUser: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await userService.deleteUser(id);
    res.status(204).send();
  }),
};
