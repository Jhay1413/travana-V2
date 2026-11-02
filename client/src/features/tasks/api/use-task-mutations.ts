import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskApi } from "./task.api";
import { taskKeys } from "./use-task-queries";
import type { InsertTaskNew } from "@shared/schema";

// Every task list (entity, client page, user, dashboard, global) is keyed under
// taskKeys.all, so invalidating that prefix refreshes whichever view shows the task.
function invalidateAllTaskQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

// The entity arguments are kept so existing call sites stay unchanged; the
// invalidation no longer depends on them.
export function useCreateTask(_entityType: string, _entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertTaskNew) => taskApi.create(data),
    onSuccess: () => invalidateAllTaskQueries(queryClient),
  });
}

export function useUpdateTask(_entityType: string, _entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertTaskNew> }) => taskApi.update(id, data),
    onSuccess: () => invalidateAllTaskQueries(queryClient),
  });
}

export function useToggleTask(_entityType: string, _entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskApi.toggleComplete(id),
    onSuccess: () => invalidateAllTaskQueries(queryClient),
  });
}

export function useDeleteTask(_entityType: string, _entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskApi.delete(id),
    onSuccess: () => invalidateAllTaskQueries(queryClient),
  });
}
