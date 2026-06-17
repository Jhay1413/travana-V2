import { useMutation, useQueryClient } from "@tanstack/react-query";
import { smsApi, type SmsTemplateInput, type SendSmsInput } from "./sms.api";
import { smsKeys } from "./use-sms-queries";

export function useCreateSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SmsTemplateInput) => smsApi.createTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsKeys.templates }),
  });
}

export function useUpdateSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SmsTemplateInput }) =>
      smsApi.updateTemplate(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsKeys.templates }),
  });
}

export function useDeleteSmsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => smsApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: smsKeys.templates }),
  });
}

export function useSendSms() {
  return useMutation({
    mutationFn: (input: SendSmsInput) => smsApi.send(input),
  });
}
