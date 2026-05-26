import { useQuery } from "@tanstack/react-query";
import { smsApi } from "@/api/endpoints/sms.api";

export const smsKeys = {
  templates: ["sms", "templates"] as const,
};

export function useSmsTemplates() {
  return useQuery({
    queryKey: smsKeys.templates,
    queryFn: () => smsApi.listTemplates(),
    staleTime: 30_000,
  });
}
