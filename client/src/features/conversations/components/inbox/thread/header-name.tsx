import { Link as RouterLink } from "wouter";
import { useContactLink } from "../../../api/use-contact-link";
import { contactLinkMatch } from "../../client-link-section";
import type { Conversation } from "../../../types";

// The contact's name in the thread header — clickable when this conversation is
// linked to a CRM client; plain text otherwise. Shares the contact-link query
// (and its cache) with the client pane.
export function ConversationHeaderName({ conversation }: { conversation: Conversation }) {
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const clientId = link?.linkedClient?.id;
  if (clientId) {
    return (
      <RouterLink
        href={`/clients/${clientId}`}
        className="truncate text-[18px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
        data-testid="conversation-client-name-link"
      >
        {conversation.contact.displayName}
      </RouterLink>
    );
  }
  return <span className="truncate text-[18px] font-semibold">{conversation.contact.displayName}</span>;
}
