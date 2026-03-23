import { useQuery } from "@tanstack/react-query";
import { emailApi } from "@/api/endpoints/email.api";
import type { EmailAccountPublic, ImapMessage, ImapMessageFull } from "@/api/endpoints/email.api";

export const emailKeys = {
  all: ["emails"] as const,
  accounts: (userId: string) => [...emailKeys.all, "accounts", userId] as const,
  messages: (accountId: string, folder: string) => [...emailKeys.all, "messages", accountId, folder] as const,
  message: (accountId: string, uid: number, folder: string) => [...emailKeys.all, "message", accountId, uid, folder] as const,
};

export function useEmailAccounts(userId: string) {
  return useQuery<EmailAccountPublic[]>({
    queryKey: emailKeys.accounts(userId),
    queryFn: () => emailApi.listAccounts(userId),
    enabled: !!userId,
  });
}

export function useEmailMessages(accountId: string, folder: string, enabled = true) {
  return useQuery<ImapMessage[]>({
    queryKey: emailKeys.messages(accountId, folder),
    queryFn: () => emailApi.fetchMessages(accountId, folder),
    enabled: !!accountId && enabled,
    staleTime: 30_000,
  });
}

export function useEmailMessage(accountId: string, uid: number, folder: string, enabled = true) {
  return useQuery<ImapMessageFull>({
    queryKey: emailKeys.message(accountId, uid, folder),
    queryFn: () => emailApi.fetchMessageById(accountId, uid, folder),
    enabled: !!accountId && uid > 0 && enabled,
  });
}
