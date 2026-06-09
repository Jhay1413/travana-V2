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

  async listByUser(
    userId: string,
    scope?: Scope,
    filters?: { dueFrom?: Date; dueTo?: Date; incomplete?: boolean },
  ): Promise<TaskWithClient[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findAllWithClientTasks(userId, scope, filters);
  },

  async create(data: InsertTaskNew, scope?: Scope): Promise<TaskNew> {
    return await taskRepository.create(data, scope);
  },

  async update(id: string, data: Partial<InsertTaskNew>, scope?: Scope): Promise<TaskNew> {
    // Keep completedAt in step with the completed flag so it matches what the
    // toggle endpoint stamps — the controller never accepts completedAt directly.
    const patch: Partial<InsertTaskNew> =
      data.completed === undefined
        ? data
        : { ...data, completedAt: data.completed ? new Date() : null };
    const result = await taskRepository.update(id, patch, scope);
    if (!result) throw new AppError("Task not found", 404);
    return result;
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

  async completeByEntity(entityType: string, entityId: string): Promise<void> {
    await taskRepository.completeByEntity(entityType, entityId);
  },
};
