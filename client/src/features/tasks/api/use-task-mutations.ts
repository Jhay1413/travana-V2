import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi } from "./task.api";
import { taskKeys } from "./use-task-queries";
import type { InsertTaskNew } from "@shared/schema";

function invalidateAllTaskQueries(queryClient: ReturnType<typeof useQueryClient>, entityType: string, entityId: string) {
  queryClient.invalidateQueries({ queryKey: taskKeys.byEntity(entityType, entityId) });
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
  queryClient.invalidateQueries({ queryKey: taskKeys.list() });
  queryClient.invalidateQueries({ queryKey: taskKeys.listExtended() });
}

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

export function useUpdateTask(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertTaskNew> }) => taskApi.update(id, data),
    onSuccess: () => {
      // byUser keys live under taskKeys.all, so this also refreshes the
      // "What's on" lists regardless of which view triggered the edit.
      invalidateAllTaskQueries(queryClient, entityType, entityId);
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
