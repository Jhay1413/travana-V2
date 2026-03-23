import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailApi } from "@/api/endpoints/email.api";
import type { CreateEmailAccountData, SendEmailPayload } from "@/api/endpoints/email.api";
import { emailKeys } from "@/hooks/queries/use-email-queries";
import { useToast } from "@/hooks/use-toast";

export function useCreateEmailAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: CreateEmailAccountData) => emailApi.createAccount(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.accounts(variables.userId) });
      toast({ title: "Email account connected successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to connect account", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteEmailAccount(userId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => emailApi.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.accounts(userId) });
      toast({ title: "Email account disconnected" });
    },
  });
}

export function useSendEmail() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: SendEmailPayload }) =>
      emailApi.sendEmail(accountId, payload),
    onSuccess: () => {
      toast({ title: "Email sent" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    },
  });
}
