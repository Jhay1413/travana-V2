import { useQuery } from "@tanstack/react-query";
import { homeworkersApi } from "./homeworkers.api";
import type { HomeworkerListItem, HomeworkerMe } from "../types";

export const homeworkerKeys = {
  all: ["homeworkers"] as const,
  list: (includeArchived: boolean) => [...homeworkerKeys.all, "list", includeArchived] as const,
  me: () => [...homeworkerKeys.all, "me"] as const,
};

export function useHomeworkers(includeArchived: boolean) {
  return useQuery<HomeworkerListItem[]>({
    queryKey: homeworkerKeys.list(includeArchived),
    queryFn: () => homeworkersApi.list(includeArchived),
  });
}

/** Own homeworker branch. A 404 (not a homeworker) yields an error state; callers hide the card. */
export function useHomeworkerMe(options?: { enabled?: boolean }) {
  return useQuery<HomeworkerMe>({
    queryKey: homeworkerKeys.me(),
    queryFn: homeworkersApi.me,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}
