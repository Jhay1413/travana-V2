import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi } from "@/api/endpoints/task.api";
import { taskKeys } from "@/hooks/queries/use-task-queries";
import type { InsertTaskNew } from "@shared/schema";

export function useCreateTask(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertTaskNew) => taskApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byEntity(entityType, entityId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.list() });
      queryClient.invalidateQueries({ queryKey: taskKeys.listExtended() });
    },
  });
}

export function useToggleTask(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskApi.toggleComplete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byEntity(entityType, entityId) });
    },
  });
}

export function useDeleteTask(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byEntity(entityType, entityId) });
    },
  });
}
