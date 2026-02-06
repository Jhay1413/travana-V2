import { useQuery } from "@tanstack/react-query";
import { userApi } from "@/api";
import type { User } from "@/types/user";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: () => [...userKeys.lists()] as const,
};

export function useUsers() {
  return useQuery<User[]>({
    queryKey: userKeys.list(),
    queryFn: userApi.getAll,
  });
}
