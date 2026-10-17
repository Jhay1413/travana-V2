import { useMemo } from "react";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTransactions } from "@/hooks/queries";
import { useContactLink } from "../../../api/use-contact-link";
import type { Conversation } from "../../../types";
import { ChannelAvatar } from "../shared";
import { ClientLinkSection, contactLinkMatch } from "../../client-link-section";
import { ClientHeader } from "./client-header";
import { DealsSection } from "./deals-section";
import { clientMoneyStats, selectExpiredDeals, selectLiveDeals } from "./deals";
import { NotesSection } from "./notes-section";
import { StatTiles } from "./stat-tiles";
import { TasksSection } from "./tasks-section";

export interface ClientPaneProps {
  conversation: Conversation;
  /** Owner decides with useMediaQuery("(min-width: 1500px)"). */
  mode: "card" | "sheet";
  /** Sheet mode only. */
  open?: boolean;
  onOpenChange?(open: boolean): void;
  /** Owner triggers the existing GenerateEnquiryButton flow. */
  onCreateEnquiry(): void;
  /** True while the AI is drafting an enquiry; disables the button. */
  creatingEnquiry?: boolean;
  /** Opens the owner's single create-ticket dialog. The button is hidden when omitted. */
  onCreateTicket?(): void;
}

function PaneBody({
  conversation,
  onCreateEnquiry,
  creatingEnquiry,
  onCreateTicket,
}: {
  conversation: Conversation;
  onCreateEnquiry(): void;
  creatingEnquiry?: boolean;
  onCreateTicket?(): void;
}) {
  // Shares the cached contact-link query with ClientLinkSection (keyed by contact id).
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const client = link?.linkedClient ?? null;
  const clientId = client?.id ?? "";
  const { data: transactions, isLoading } = useTransactions({ clientId }, { enabled: !!client?.id });

  const stats = useMemo(() => clientMoneyStats(transactions), [transactions]);
  const liveDeals = useMemo(() => (client ? selectLiveDeals(transactions, new Date()) : []), [client, transactions]);
  const expiredDeals = useMemo(() => (client ? selectExpiredDeals(transactions) : []), [client, transactions]);

  if (!client) {
    // Not linked yet: suggestions + link / create-client actions.
    const contact = conversation.contact;
    return (
      <div className="text-[14px]">
        <div className="px-5 pb-4 pt-5 text-center">
          <div className="flex justify-center">
            <ChannelAvatar
              name={contact.displayName}
              avatarUrl={contact.avatarUrl}
              channel={conversation.channel}
              size={64}
              badge={false}
            />
          </div>
          <h2 className="mt-2.5 text-[18px] font-semibold">{contact.displayName}</h2>
          {contact.handle && <p className="text-[12px] text-social-muted">{contact.handle}</p>}
          <p className="mt-1 text-[12px] text-social-muted">Not linked to a client yet</p>
        </div>
        <div className="px-5 pb-4">
          <ClientLinkSection conversation={conversation} />
        </div>
      </div>
    );
  }

  const firstName = client.firstName?.trim() || conversation.contact.firstName || "this client";

  return (
    <div className="text-[14px]">
      <ClientHeader conversation={conversation} client={client} onCreateEnquiry={onCreateEnquiry} creatingEnquiry={creatingEnquiry} />
      <StatTiles stats={stats} isLoading={isLoading} />
      <DealsSection
        clientId={client.id}
        firstName={firstName}
        liveDeals={liveDeals}
        expiredDeals={expiredDeals}
        isLoading={isLoading}
      />
      <TasksSection clientId={client.id} firstName={firstName} />
      <NotesSection clientId={client.id} firstName={firstName} />
      {onCreateTicket && (
        <div className="border-t border-social-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-[38px] w-full rounded-[10px]"
            onClick={onCreateTicket}
            data-testid="conversation-create-ticket"
          >
            <Ticket className="mr-2 h-4 w-4" />
            Create ticket
          </Button>
        </div>
      )}
    </div>
  );
}

export function ClientPane({ conversation, mode, open, onOpenChange, onCreateEnquiry, creatingEnquiry, onCreateTicket }: ClientPaneProps) {
  if (mode === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[380px] overflow-y-auto p-0 sm:max-w-[380px]">
          <SheetHeader className="border-b border-social-border px-4 py-3">
            <SheetTitle className="text-[14px]">Client details</SheetTitle>
            <SheetDescription className="sr-only">Details, deals, tasks and notes for this client.</SheetDescription>
          </SheetHeader>
          <PaneBody conversation={conversation} onCreateEnquiry={onCreateEnquiry} creatingEnquiry={creatingEnquiry} onCreateTicket={onCreateTicket} />
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-social-border bg-card">
      <div className="min-h-0 flex-1 overflow-y-auto">
      <PaneBody conversation={conversation} onCreateEnquiry={onCreateEnquiry} creatingEnquiry={creatingEnquiry} onCreateTicket={onCreateTicket} />
      </div>
    </aside>
  );
}
