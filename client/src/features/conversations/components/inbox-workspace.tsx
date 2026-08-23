import ConversationsInbox from "./conversations-inbox";

/**
 * The inbox shell.
 *
 * Previously this also hosted a Messages / Comments switcher (social comments
 * have their own lifecycle — see comments-panel.tsx). The switcher was removed
 * from the top of the inbox per the redesign; the CommentsPanel component is
 * kept intact for when comments get a home of their own.
 */
export function InboxWorkspace() {
  return <ConversationsInbox />;
}
