import { Request, Response } from "express";
import { userService } from "./user.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";

function stripPassword<T extends { password?: string | null }>(user: T): Omit<T, "password"> {
  const { password, ...rest } = user;
  return rest;
}

export const userController = {
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const salesAgentsOnly = req.query.salesAgentsOnly === "true";
    const users = await userService.listUsers(getScope(req), { salesAgentsOnly });
    return successResponse(res, users.map(stripPassword), "Users retrieved successfully");
  }),

  getUserById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await userService.getUserById(id, getScope(req));
    return successResponse(res, stripPassword(user), "User retrieved successfully");
  }),

  createUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body, getScope(req));
    return successResponse(res, user, "User created successfully", 201);
  }),

  updateUser: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await userService.updateUser(id, req.body, getScope(req));
    return successResponse(res, user, "User updated successfully");
  }),

  deleteUser: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await userService.deleteUser(id, getScope(req));
    res.status(204).send();
  }),
};
