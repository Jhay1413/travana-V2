import axiosClient from "../client/axios-client";
import type { TaskNew, InsertTaskNew } from "@shared/schema";

export type TaskWithClient = TaskNew & {
  clientId: string | null;
  clientName: string | null;
  tags: string[];
  entityTitle: string | null;
  entityPrice: string | null;
  entityCommission: string | null;
  entityTravelDate: string | null;
};

export const taskApi = {
  getAll: async (): Promise<TaskWithClient[]> => {
    const { data } = await axiosClient.get<TaskWithClient[]>("/api/v2/tasks/all");
    return data;
  },

  getAllExtended: async (): Promise<TaskWithClient[]> => {
    const { data } = await axiosClient.get<TaskWithClient[]>("/api/v2/tasks/all-extended");
    return data;
  },

  getByEntity: async (entityType: string, entityId: string): Promise<TaskNew[]> => {
    const { data } = await axiosClient.get<TaskNew[]>(`/api/v2/tasks?entityType=${entityType}&entityId=${entityId}`);
    return data;
  },

  getByUser: async (
    userId: string,
    filters?: { dueFrom?: string; dueTo?: string; incomplete?: boolean },
  ): Promise<TaskWithClient[]> => {
    const params = new URLSearchParams({ userId });
    if (filters?.dueFrom) params.set("dueFrom", filters.dueFrom);
    if (filters?.dueTo) params.set("dueTo", filters.dueTo);
    if (filters?.incomplete) params.set("incomplete", "true");
    const { data } = await axiosClient.get<TaskWithClient[]>(`/api/v2/tasks/user?${params.toString()}`);
    return data;
  },

  create: async (taskData: InsertTaskNew): Promise<TaskNew> => {
    const { data } = await axiosClient.post<TaskNew>("/api/v2/tasks", taskData);
    return data;
  },

  update: async (id: string, taskData: Partial<InsertTaskNew>): Promise<TaskNew> => {
    const { data } = await axiosClient.put<TaskNew>(`/api/v2/tasks/${id}`, taskData);
    return data;
  },

  toggleComplete: async (id: string): Promise<TaskNew> => {
    const { data } = await axiosClient.put<TaskNew>(`/api/v2/tasks/${id}/toggle`);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/tasks/${id}`);
  },
};
