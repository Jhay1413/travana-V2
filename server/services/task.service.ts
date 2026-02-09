import { taskRepository } from "../repositories/task.repository";
import { AppError } from "../utils/error-handler";
import type { Task, InsertTask } from "@shared/schema";

export const taskService = {
  async listAll(): Promise<Task[]> {
    return await taskRepository.findAll();
  },

  async listByEntity(entityType: string, entityId: string): Promise<Task[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByEntity(entityType, entityId);
  },

  async listByUser(userId: string): Promise<Task[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByUserId(userId);
  },

  async create(data: InsertTask): Promise<Task> {
    return await taskRepository.create(data);
  },

  async toggleComplete(id: string): Promise<Task> {
    const result = await taskRepository.toggleComplete(id);
    if (!result) throw new AppError("Task not found", 404);
    return result;
  },

  async remove(id: string): Promise<void> {
    await taskRepository.remove(id);
  },
};
