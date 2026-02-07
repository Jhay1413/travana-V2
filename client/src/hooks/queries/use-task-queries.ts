import { useQuery } from "@tanstack/react-query";
import { taskApi } from "@/api/endpoints/task.api";
import type { Task } from "@shared/schema";

export const taskKeys = {
  all: ["tasks"] as const,
  byEntity: (entityType: string, entityId: string) =>
    [...taskKeys.all, "byEntity", entityType, entityId] as const,
  byUser: (userId: string) => [...taskKeys.all, "byUser", userId] as const,
};

export function useTasks(entityType: string, entityId: string) {
  return useQuery<Task[]>({
    queryKey: taskKeys.byEntity(entityType, entityId),
    queryFn: () => taskApi.getByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useUserTasks(userId: string) {
  return useQuery<Task[]>({
    queryKey: taskKeys.byUser(userId),
    queryFn: () => taskApi.getByUser(userId),
    enabled: !!userId,
  });
}
