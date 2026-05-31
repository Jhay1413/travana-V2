import { useQuery } from "@tanstack/react-query";
import { userApi } from "@/api";
import type { User } from "@/types/user";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (salesAgentsOnly = false) => [...userKeys.lists(), { salesAgentsOnly }] as const,
};

export function useUsers(opts?: { salesAgentsOnly?: boolean }) {
  const salesAgentsOnly = opts?.salesAgentsOnly === true;
  return useQuery<User[]>({
    queryKey: userKeys.list(salesAgentsOnly),
    queryFn: () => userApi.getAll({ salesAgentsOnly }),
  });
}
