import axiosClient from "../client/axios-client";
import type { TaskNew, InsertTaskNew } from "@shared/schema";

export type TaskWithClient = TaskNew & { clientId: string | null; clientName: string | null; tags: string[] };

export const taskApi = {
  getAll: async (): Promise<TaskWithClient[]> => {
    const { data } = await axiosClient.get<TaskWithClient[]>("/api/tasks/all");
    return data;
  },

  getAllExtended: async (): Promise<TaskWithClient[]> => {
    const { data } = await axiosClient.get<TaskWithClient[]>("/api/tasks/all-extended");
    return data;
  },

  getByEntity: async (entityType: string, entityId: string): Promise<TaskNew[]> => {
    const { data } = await axiosClient.get<TaskNew[]>(`/api/tasks?entityType=${entityType}&entityId=${entityId}`);
    return data;
  },

  getByUser: async (userId: string): Promise<TaskNew[]> => {
    const { data } = await axiosClient.get<TaskNew[]>(`/api/tasks/user?userId=${userId}`);
    return data;
  },

  create: async (taskData: InsertTaskNew): Promise<TaskNew> => {
    const { data } = await axiosClient.post<TaskNew>("/api/tasks", taskData);
    return data;
  },

  toggleComplete: async (id: string): Promise<TaskNew> => {
    const { data } = await axiosClient.put<TaskNew>(`/api/tasks/${id}/toggle`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/tasks/${id}`);
  },
};
