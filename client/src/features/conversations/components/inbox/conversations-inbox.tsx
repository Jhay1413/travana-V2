import { useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToast } from "@/hooks/use-toast";
import { clientDisplayName } from "@/lib/utils";
import { useContactLink } from "../../api/use-contact-link";
import { ChannelsDialog } from "../channels-dialog";
import { contactLinkMatch } from "../client-link-section";
import { useConversationsRealtimeState, type TypingPresence } from "../conversations-realtime-provider";
import { GenerateEnquiryButton } from "../generate-enquiry-button";
import { TestAiModal } from "../test-ai-modal";
import { ClientPane, useClientTicketDialog } from "./client-pane";
import { Composer } from "./composer";
import { InboxSwitcher, ListPane } from "./list";
import { NewMessageDialog } from "./new-message";
import { isDone, useInboxState, useThreadActions } from "./state";
import { enquiryHref, firstNameFor } from "./enquiry";
import { ThreadPane } from "./thread";

/** Typing indicator value for the thread: the typer's name, "AI", or plain typing. */
function typingLabel(presence: TypingPresence | undefined): boolean | string {
  if (!presence) return false;
  if (presence.actor === "ai") return "AI";
  return presence.name ?? true;
}

/** The inbox: list, thread and client panes, wired to the state and action hooks. */
export function ConversationsInbox() {
  const state = useInboxState();
  const { toast } = useToast();
  const actions = useThreadActions(state);
  const { selected, now } = state;
  const { connected: realtimeConnected, typingByConversation } = useConversationsRealtimeState();
  const wide = useMediaQuery("(min-width: 1500px)");
  // Lets the thread header / client pane start the composer's Generate Enquiry flow.
  const enquiryTrigger = useRef<(() => void) | null>(null);
  const createEnquiry = () => enquiryTrigger.current?.();
  const [enquiryGenerating, setEnquiryGenerating] = useState(false);

  const { data: link } = useContactLink(selected?.contact.id ?? null, selected ? contactLinkMatch(selected) : undefined);
  const client = link?.linkedClient ?? null;
  const ticket = useClientTicketDialog(client?.id, client ? clientDisplayName(client) : "");

  const pagination = state.pagination;
  const unread = state.badges?.total_unanswered ?? 0;

  return (
    <section className="flex h-[calc(100vh-7.5rem)] gap-4" data-testid="section-conversations">
      <ListPane
        rows={state.rows}
        isLoading={state.isLoading}
        isError={state.isError}
        onRetry={() => void state.refetch()}
        tab={state.tab}
        onTabChange={state.setTab}
        tabCounts={{ open: state.openCount, snoozed: state.snoozedCount }}
        unreadCount={unread}
        search={state.search}
        onSearchChange={state.setSearch}
        chip={state.chip}
        onChipChange={state.setChip}
        chipCounts={state.chipCounts}
        filters={state.filters}
        onFiltersChange={state.setFilters}
        channelCounts={state.channelCounts}
        tagOptions={state.tagOptions}
        unassignedCount={state.unassignedCount}
        sort={state.sort}
        onSortChange={state.setSort}
        selectedId={state.selectedId}
        onSelect={state.setSelectedId}
        currentUserId={state.currentUser?.id ?? null}
        staff={state.staff}
        onSnooze={actions.snoozeFor}
        onUnsnooze={actions.unsnooze}
        onDone={actions.closeConversation}
        onReopen={actions.reopen}
        onAssign={actions.assign}
        page={state.page}
        hasPrev={!!pagination?.has_prev && state.page > 1}
        hasNext={!!pagination?.has_next && state.page < (pagination?.total_pages ?? 1)}
        showPager={(pagination?.total_pages ?? 1) > 1}
        pagerDisabled={state.isFetching}
        draftTags={state.draftTags}
        onPageChange={state.setPage}
        inboxSwitcher={
          <InboxSwitcher
            inboxId={state.inboxId}
            inboxes={state.inboxList}
            activeInbox={state.activeInbox}
            onInboxChange={state.setInboxId}
            realtimeConnected={realtimeConnected}
            openCount={state.openCount}
            canManageChannels={state.canManageChannels}
            onOpenChannels={() => state.setChannelsOpen(true)}
          />
        }
        onNewMessage={() => state.setNewMessageOpen(true)}
        now={now}
      />

      <ThreadPane
        conversation={selected}
        messages={actions.threadMessages}
        isLoadingMessages={actions.messagesLoading}
        typing={typingLabel(selected ? typingByConversation[selected.id] : undefined)}
        currentUser={state.currentUser}
        staff={state.staff}
        canTestAi={state.canTestAi}
        canManageChannels={state.canManageChannels}
        onAssign={(userId) => selected && actions.assign(selected.id, userId)}
        onSnooze={(preset) => selected && actions.snoozeFor(selected.id, preset)}
        onUnsnooze={() => selected && actions.unsnooze(selected.id)}
        onDone={() => selected && actions.closeConversation(selected.id)}
        onReopen={() => selected && actions.reopen(selected.id)}
        isDone={!!selected && isDone(selected, now)}
        onMarkUnread={() => selected && state.markUnread(selected.id)}
        onOpenClientPane={() => state.setClientPaneOpen(true)}
        showClientPaneButton={!wide}
        onCreateEnquiry={createEnquiry}
        enquiryGenerating={enquiryGenerating}
        onCreateTicket={ticket.open}
        clientId={client?.id ?? null}
        onOpenTestAi={() => state.setTestAiOpen(true)}
        createdEnquiry={selected ? state.createdEnquiries[selected.id] : undefined}
        onDismissCreatedEnquiry={() => selected && state.dismissEnquiryBar(selected.id)}
        composer={
          selected && (
            // Keyed by conversation: switching threads unmounts the composer, so
            // no typed text, staged attachment, or reply/note mode can leak into
            // a message addressed to a different contact. The draft map in the
            // state hook carries the text back when you return.
            <Composer
              key={selected.id}
              composerRef={state.composerRef}
              conversation={selected}
              draft={state.draftFor(selected.id)}
              onDraftChange={(d) => state.handleDraftChange(selected.id, d)}
              onSend={actions.sendReply}
              onAddNote={actions.sendNote}
              isSending={actions.isSending}
              firstName={firstNameFor(client, selected.contact)}
              generateEnquiry={
                <GenerateEnquiryButton
                  conversation={selected}
                  triggerRef={enquiryTrigger}
                  onGeneratingChange={setEnquiryGenerating}
                  onAskClient={(text) => {
                    state.askClient(selected.id, text);
                    toast({ title: `Question for ${firstNameFor(client, selected.contact)} added to your reply. Check it, then send.` });
                  }}
                  onCreated={(created) =>
                    state.markEnquiryCreated(selected.id, {
                      title: created.title,
                      href: enquiryHref(created.clientId, created.enquiryId),
                    })
                  }
                />
              }
            />
          )
        }
      />

      {selected && (
        <ClientPane
          conversation={selected}
          mode={wide ? "card" : "sheet"}
          open={state.clientPaneOpen}
          onOpenChange={state.setClientPaneOpen}
          onCreateEnquiry={createEnquiry}
          creatingEnquiry={enquiryGenerating}
          onCreateTicket={ticket.open}
        />
      )}
      {ticket.dialog}
      <NewMessageDialog open={state.newMessageOpen} onOpenChange={state.setNewMessageOpen} />
      {state.canManageChannels && <ChannelsDialog open={state.channelsOpen} onOpenChange={state.setChannelsOpen} />}
      {state.canTestAi && selected && (
        <TestAiModal conversationId={selected.id} open={state.testAiOpen} onOpenChange={state.setTestAiOpen} />
      )}
    </section>
  );
}
