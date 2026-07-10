import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactLinkApi, type CreateClientForContactInput } from "./contact-link.api";

export const contactLinkKeys = {
  all: ["contact-link"] as const,
  status: (contactId: string) => [...contactLinkKeys.all, contactId] as const,
};

export function useContactLink(
  contactId: string | null,
  match?: { phone?: string; email?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: contactLinkKeys.status(contactId ?? ""),
    queryFn: () => contactLinkApi.getStatus(contactId as string, match),
    enabled: !!contactId && enabled,
    staleTime: 30_000,
  });
}

export function useLinkContact(contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => contactLinkApi.link(contactId, clientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactLinkKeys.status(contactId) }),
  });
}

export function useCreateAndLinkContact(contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientForContactInput) => contactLinkApi.createAndLink(contactId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactLinkKeys.status(contactId) }),
  });
}

export function useUnlinkContact(contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => contactLinkApi.unlink(contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactLinkKeys.status(contactId) }),
  });
}
