import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contactLinkApi, type CreateClientForContactInput } from "./contact-link.api";

export const contactLinkKeys = {
  all: ["contact-link"] as const,
  status: (contactId: string) => [...contactLinkKeys.all, contactId] as const,
  byClient: (clientId: string) => [...contactLinkKeys.all, "by-client", clientId] as const,
};

// The SendSeven contact a client is linked to (null when not connected).
export function useClientContactLink(clientId: string | null, enabled = true) {
  return useQuery({
    queryKey: contactLinkKeys.byClient(clientId ?? ""),
    queryFn: () => contactLinkApi.getByClient(clientId as string),
    enabled: !!clientId && enabled,
    staleTime: 60_000,
  });
}

export function useContactLink(
  contactId: string | null,
  match?: { phone?: string; email?: string; name?: string },
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
    // Invalidate the whole namespace so both the by-contact status and the
    // client dashboard's by-client view refresh after a link change.
    onSuccess: () => qc.invalidateQueries({ queryKey: contactLinkKeys.all }),
  });
}

export function useCreateAndLinkContact(contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientForContactInput) => contactLinkApi.createAndLink(contactId, input),
    // Invalidate the whole namespace so both the by-contact status and the
    // client dashboard's by-client view refresh after a link change.
    onSuccess: () => qc.invalidateQueries({ queryKey: contactLinkKeys.all }),
  });
}

export function useUnlinkContact(contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => contactLinkApi.unlink(contactId),
    // Invalidate the whole namespace so both the by-contact status and the
    // client dashboard's by-client view refresh after a link change.
    onSuccess: () => qc.invalidateQueries({ queryKey: contactLinkKeys.all }),
  });
}
