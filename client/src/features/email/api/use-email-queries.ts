import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { emailApi } from "./email.api";
import type {
  EmailAccountPublic,
  EmailMessagesPage,
  ImapMessageFull,
} from "./email.api";

export const emailKeys = {
  all: ["emails"] as const,
  sharedAccount: [...["emails"], "shared-account"] as const,
  accounts: (userId: string) => [...emailKeys.all, "accounts", userId] as const,
  messages: (accountId: string, folder: string, page: number, pageSize: number) =>
    [...emailKeys.all, "messages", accountId, folder, page, pageSize] as const,
  message: (accountId: string, uid: number, folder: string) => [...emailKeys.all, "message", accountId, uid, folder] as const,
};

export function useSharedEmailAccount() {
  return useQuery<EmailAccountPublic | null>({
    queryKey: emailKeys.sharedAccount,
    queryFn: () => emailApi.getSharedAccount(),
  });
}

export function useEmailAccounts(userId: string) {
  return useQuery<EmailAccountPublic[]>({
    queryKey: emailKeys.accounts(userId),
    queryFn: () => emailApi.listAccounts(userId),
    enabled: !!userId,
  });
}

export function useEmailMessages(
  accountId: string,
  folder: string,
  page = 1,
  pageSize = 50,
  enabled = true,
) {
  return useQuery<EmailMessagesPage>({
    queryKey: emailKeys.messages(accountId, folder, page, pageSize),
    queryFn: () => emailApi.fetchMessages(accountId, folder, page, pageSize),
    enabled: !!accountId && enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useEmailMessage(accountId: string, uid: number, folder: string, enabled = true) {
  return useQuery<ImapMessageFull>({
    queryKey: emailKeys.message(accountId, uid, folder),
    queryFn: () => emailApi.fetchMessageById(accountId, uid, folder),
    enabled: !!accountId && uid > 0 && enabled,
  });
}
