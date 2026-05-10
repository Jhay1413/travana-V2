import { taskRepository, type TaskWithClient } from "./task.repository";
import { AppError } from "../../utils/error-handler";
import { tasks } from "@shared/schema";
import type { Scope } from "../../utils/scope";

type TaskNew = typeof tasks.$inferSelect;
type InsertTaskNew = typeof tasks.$inferInsert;

export const taskService = {
  async listAll(userId?: string, scope?: Scope): Promise<TaskWithClient[]> {
    return await taskRepository.findAll(userId, scope);
  },

  async listAllWithClientTasks(userId?: string, scope?: Scope): Promise<TaskWithClient[]> {
    return await taskRepository.findAllWithClientTasks(userId, scope);
  },

  async listByEntity(entityType: string, entityId: string, scope?: Scope): Promise<TaskNew[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByEntity(entityType, entityId, scope);
  },

  async listByUser(userId: string, scope?: Scope): Promise<TaskNew[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByUserId(userId, scope);
  },

  async create(data: InsertTaskNew, scope?: Scope): Promise<TaskNew> {
    return await taskRepository.create(data, scope);
  },

  async toggleComplete(id: string, scope?: Scope): Promise<TaskNew> {
    const result = await taskRepository.toggleComplete(id, scope);
    if (!result) throw new AppError("Task not found", 404);
    return result;
  },

  async remove(id: string, scope?: Scope): Promise<void> {
    const removed = await taskRepository.remove(id, scope);
    if (!removed) throw new AppError("Task not found", 404);
  },

  async reassignByEntity(entityType: string, entityId: string, newUserId: string): Promise<void> {
    await taskRepository.reassignByEntity(entityType, entityId, newUserId);
  },
};
