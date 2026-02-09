import axiosClient from "../client/axios-client";
import type { Task, InsertTask } from "@shared/schema";

export type TaskWithClient = Task & { clientId: string | null; clientName: string | null; tags: string[] };

export const taskApi = {
  getAll: async (): Promise<TaskWithClient[]> => {
    const { data } = await axiosClient.get<TaskWithClient[]>("/api/tasks/all");
    return data;
  },

  getByEntity: async (entityType: string, entityId: string): Promise<Task[]> => {
    const { data } = await axiosClient.get<Task[]>(`/api/tasks?entityType=${entityType}&entityId=${entityId}`);
    return data;
  },

  getByUser: async (userId: string): Promise<Task[]> => {
    const { data } = await axiosClient.get<Task[]>(`/api/tasks/user?userId=${userId}`);
    return data;
  },

  create: async (taskData: InsertTask): Promise<Task> => {
    const { data } = await axiosClient.post<Task>("/api/tasks", taskData);
    return data;
  },

  toggleComplete: async (id: string): Promise<Task> => {
    const { data } = await axiosClient.put<Task>(`/api/tasks/${id}/toggle`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/tasks/${id}`);
  },
};
