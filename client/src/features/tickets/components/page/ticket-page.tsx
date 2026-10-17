import { useState } from "react";
import { Link, useLocation } from "wouter";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { UnderlineTabs } from "@/components/shared/underline-tabs";
import { useUsers } from "@/hooks/queries";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useTicket } from "../../api/use-ticket-queries";
import { prevNext } from "../../lib/ticket-nav";
import { useNow } from "../../state/use-now";
import { useTicketQueue } from "../../state/use-ticket-queue";
import type { Ticket } from "../../types";
import { CreateTicketDialog } from "../dialogs/new-ticket/create-ticket-dialog";
import { BookingPanel } from "../panels/booking-panel";
import { ClientPanel } from "../panels/client-panel";
import { TicketConversation } from "../thread/ticket-conversation";
import { TicketCentreHeader } from "./ticket-centre-header";
import { TicketMobileHeader } from "./ticket-mobile-header";
import { TicketPageHeader } from "./ticket-page-header";

type SideTab = "booking" | "client";
type MobileTab = "conversation" | "client" | "booking";

const PANEL = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-social-border bg-card";

function NotFound() {
  return (
    <div className="grid flex-1 place-items-center rounded-2xl border border-social-border bg-card p-10 text-center" data-testid="ticket-not-found">
      <div>
        <span className="inline-grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-muted">
          <SearchX className="h-6 w-6 text-social-muted" strokeWidth={1.8} />
        </span>
        <div className="mt-3 text-[16px] font-semibold">Ticket not found</div>
        <p className="mt-1 text-[13px] text-social-muted">It may have been deleted, or you may not have access to it.</p>
        <Link href="/tickets" className="mt-3 inline-block text-[13px] font-semibold text-social-orange-text hover:underline">
          Back to Tickets
        </Link>
      </div>
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center rounded-2xl border border-social-border bg-card p-10 text-center" data-testid="ticket-load-failed">
      <div>
        <div className="text-[16px] font-semibold">Couldn&apos;t load ticket</div>
        <p className="mt-1 text-[13px] text-social-muted">Something went wrong while loading this ticket.</p>
        <Button type="button" variant="outline" className="mt-3" onClick={onRetry} data-testid="ticket-load-retry">
          Try again
        </Button>
      </div>
    </div>
  );
}

/** /tickets/:id: client panel, the team conversation, and the booking panel. */
export function TicketPage({ ticketId }: { ticketId: string }) {
  const [, navigate] = useLocation();
  const { data: ticket, isLoading, error, refetch } = useTicket(ticketId);
  const status = (error as { status?: number } | null)?.status;
  const { data: users = [] } = useUsers();
  const { result } = useTicketQueue();
  const now = useNow();
  const wide = useMediaQuery("(min-width: 1560px)");
  const mobile = useMediaQuery("(max-width: 900px)");
  const [side, setSide] = useState<SideTab>("booking");
  const [mobileTab, setMobileTab] = useState<MobileTab>("conversation");
  const [linkOpen, setLinkOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const shell = "flex h-[calc(100vh-7rem)] min-h-[560px] min-w-0 flex-col gap-3.5 text-[14px] leading-[1.5]";

  if (status === 404 || !ticket) {
    return (
      <div className={shell} data-testid="section-ticket-page">
        {status === 404 ? (
          <NotFound />
        ) : isLoading ? (
          <div className="flex flex-1 items-center justify-center"><Spinner /></div>
        ) : error ? (
          <LoadFailed onRetry={() => void refetch()} />
        ) : (
          <NotFound />
        )}
      </div>
    );
  }

  const menu = {
    onNewForClient: () => setNewOpen(true),
    linkOpen,
    onLinkOpenChange: setLinkOpen,
  };
  const openLink = () => {
    setLinkOpen(true);
  };
  const dialog = (
    <CreateTicketDialog open={newOpen} onOpenChange={setNewOpen} initialClientId={ticket.clientId || undefined} onCreated={(created: Ticket) => navigate(`/tickets/${created.id}`)} />
  );

  const centre = (
    <section className={cn(PANEL, "flex-1")} aria-label="Conversation" data-testid="ticket-centre">
      {!mobile && <TicketCentreHeader ticket={ticket} users={users} />}
      <TicketConversation ticket={ticket} users={users} compact={mobile} />
    </section>
  );
  const clientPanel = <ClientPanel ticket={ticket} className="min-h-0 flex-1" />;
  const bookingPanel = <BookingPanel ticket={ticket} onChange={openLink} className="min-h-0 flex-1" />;

  if (mobile) {
    return (
      <div className={shell} data-testid="section-ticket-page">
        <TicketMobileHeader ticket={ticket} users={users} now={now} menu={menu} />
        <UnderlineTabs<MobileTab>
          label="Ticket sections"
          testIdPrefix="ticket-mobile-tab"
          value={mobileTab}
          onChange={setMobileTab}
          tabs={[
            { value: "conversation", label: "Conversation" },
            { value: "client", label: "Client" },
            { value: "booking", label: "Booking" },
          ]}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          {mobileTab === "conversation" ? centre : mobileTab === "client" ? clientPanel : bookingPanel}
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className={shell} data-testid="section-ticket-page">
      <TicketPageHeader ticket={ticket} nav={prevNext(result.orderIds, ticket.id)} menu={menu} />
      <div className="flex min-h-0 flex-1 gap-4">
        {wide ? (
          <>
            <div className="flex w-[340px] flex-none flex-col">{clientPanel}</div>
            {centre}
            <div className="flex w-[400px] flex-none flex-col">{bookingPanel}</div>
          </>
        ) : (
          <>
            {centre}
            <div className="flex w-[400px] flex-none flex-col gap-2.5">
              <Segmented<SideTab>
                label="Side panel"
                variant="black"
                height={38}
                className="w-full"
                itemClassName="flex-1"
                value={side}
                onChange={setSide}
                items={[
                  { value: "booking", label: "Booking", testId: "ticket-side-booking" },
                  { value: "client", label: "Client", testId: "ticket-side-client" },
                ]}
              />
              <div className="flex min-h-0 flex-1 flex-col">{side === "client" ? clientPanel : bookingPanel}</div>
            </div>
          </>
        )}
      </div>
      {dialog}
    </div>
  );
}
