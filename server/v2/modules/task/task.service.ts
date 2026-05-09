import { taskRepository, type TaskWithClient } from "./task.repository";
import { AppError } from "../../utils/error-handler";
import { tasks } from "@shared/schema";

type TaskNew = typeof tasks.$inferSelect;
type InsertTaskNew = typeof tasks.$inferInsert;

export const taskService = {
  async listAll(userId?: string): Promise<TaskWithClient[]> {
    return await taskRepository.findAll(userId);
  },

  async listAllWithClientTasks(userId?: string): Promise<TaskWithClient[]> {
    return await taskRepository.findAllWithClientTasks(userId);
  },

  async listByEntity(entityType: string, entityId: string): Promise<TaskNew[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByEntity(entityType, entityId);
  },

  async listByUser(userId: string): Promise<TaskNew[]> {
    await taskRepository.checkAndNotifyDueTasks();
    return await taskRepository.findByUserId(userId);
  },

  async create(data: InsertTaskNew): Promise<TaskNew> {
    return await taskRepository.create(data);
  },

  async toggleComplete(id: string): Promise<TaskNew> {
    const result = await taskRepository.toggleComplete(id);
    if (!result) throw new AppError("Task not found", 404);
    return result;
  },

  async remove(id: string): Promise<void> {
    await taskRepository.remove(id);
  },

  async reassignByEntity(entityType: string, entityId: string, newUserId: string): Promise<void> {
    await taskRepository.reassignByEntity(entityType, entityId, newUserId);
  },
};
