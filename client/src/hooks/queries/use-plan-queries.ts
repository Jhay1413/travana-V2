import { useQuery } from "@tanstack/react-query";
import { planApi, type Plan } from "@/api/endpoints/plan.api";

export const planKeys = {
  all: ["plans"] as const,
  list: () => [...planKeys.all, "list"] as const,
};

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: planKeys.list(),
    queryFn: planApi.list,
  });
}
