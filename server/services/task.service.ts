import { taskRepository, type TaskWithClient } from "../repositories/task.repository";
import { AppError } from "../utils/error-handler";
import { tasks } from "@shared/schema";

type LegacyTask = typeof tasks.$inferSelect;
type InsertLegacyTask = typeof tasks.$inferInsert;

export const taskService = {
  async listAll(): Promise<TaskWithClient[]> {
    return await taskRepository.findAll();
  },

  async listByEntity(entityType: string, entityId: string): Promise<LegacyTask[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByEntity(entityType, entityId);
  },

  async listByUser(userId: string): Promise<LegacyTask[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByUserId(userId);
  },

  async create(data: InsertLegacyTask): Promise<LegacyTask> {
    return await taskRepository.create(data);
  },

  async toggleComplete(id: string): Promise<LegacyTask> {
    const result = await taskRepository.toggleComplete(id);
    if (!result) throw new AppError("Task not found", 404);
    return result;
  },

  async remove(id: string): Promise<void> {
    await taskRepository.remove(id);
  },
};
