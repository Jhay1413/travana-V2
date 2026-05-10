import { useQuery } from "@tanstack/react-query";
import { taskApi, type TaskWithClient } from "@/api/endpoints/task.api";
import type { TaskNew } from "@shared/schema";

export const taskKeys = {
  all: ["tasks"] as const,
  list: () => [...taskKeys.all, "list"] as const,
  listExtended: () => [...taskKeys.all, "listExtended"] as const,
  byEntity: (entityType: string, entityId: string) =>
    [...taskKeys.all, "byEntity", entityType, entityId] as const,
  byUser: (userId: string) => [...taskKeys.all, "byUser", userId] as const,
};

export function useAllTasks() {
  return useQuery<TaskWithClient[]>({
    queryKey: taskKeys.list(),
    queryFn: () => taskApi.getAll(),
  });
}

export function useAllTasksExtended() {
  return useQuery<TaskWithClient[]>({
    queryKey: taskKeys.listExtended(),
    queryFn: () => taskApi.getAllExtended(),
  });
}

export function useTasks(entityType: string, entityId: string) {
  return useQuery<TaskNew[]>({
    queryKey: taskKeys.byEntity(entityType, entityId),
    queryFn: () => taskApi.getByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useUserTasks(
  userId: string,
  filters?: { dueFrom?: string; dueTo?: string; incomplete?: boolean },
) {
  return useQuery<TaskWithClient[]>({
    queryKey: [...taskKeys.byUser(userId), filters ?? {}] as const,
    queryFn: () => taskApi.getByUser(userId, filters),
    enabled: !!userId,
  });
}
