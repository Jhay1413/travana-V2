import { Link } from "wouter";
import { ExternalLink, Mail, MessageSquare, Phone } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { useClient } from "@/hooks/queries";
import { useClientContactLink } from "@/features/conversations";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { clientDisplayName } from "@/lib/utils";
import { cleanClientName } from "../../lib/ticket-display";
import { cleanContact, memberSince, type RawClientRow } from "../../lib/raw-client";
import type { Ticket } from "../../types";
import { InternalTicketPanel } from "./internal-ticket-panel";
import { CopyButton, PanelShell } from "./panel-parts";
import { PastTickets } from "./past-tickets";

const ACTION = `${OUTLINE_ACTION} h-9 flex-1 px-0 text-[13px]`;

function ContactRow({ icon, text, strong }: { icon: React.ReactNode; text: string; strong?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-1 text-[13px]">
      <span className="mt-0.5 flex text-social-muted">{icon}</span>
      <div className={`min-w-0 flex-1 break-words ${strong ? "font-semibold" : ""}`}>{text}</div>
      <CopyButton text={text} label={text} />
    </div>
  );
}

/** Left-hand panel: who the ticket is for, contact actions, and their other tickets. */
export function ClientPanel({ ticket, className }: { ticket: Ticket; className?: string }) {
  const clientId = ticket.clientId || null;
  const { data: client, isLoading } = useClient(clientId ?? "");
  const { data: contactLink } = useClientContactLink(clientId);
  if (!clientId) return <InternalTicketPanel className={className} />;

  const raw = client as unknown as RawClientRow | undefined;
  const name = (raw && clientDisplayName(raw)) || cleanClientName(ticket.clientName);
  const phone = cleanContact(raw?.phoneNumber) ?? cleanContact(ticket.clientPhone);
  const email = cleanContact(raw?.email);
  const since = memberSince(raw?.createdAt);

  return (
    <PanelShell label="Client" className={className}>
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="ticket-client-panel">
        {isLoading && !name ? (
          <p className="px-[18px] py-4 text-[12px] text-social-muted">Loading client…</p>
        ) : !name ? (
          <p className="px-[18px] py-4 text-[12px] text-social-muted">Couldn&apos;t load this client&apos;s details.</p>
        ) : (
          <>
            <div className="flex items-center gap-3.5 px-[18px] pb-3 pt-[18px]">
              <PersonAvatar name={name} size={56} />
              <div className="min-w-0">
                <Link href={`/clients/${clientId}`} className="block truncate text-[18px] font-semibold leading-[1.3] hover:underline" data-testid="ticket-client-name-link">
                  {name}
                </Link>
                {since && <div className="text-[12px] text-social-muted">Client since {since}</div>}
              </div>
            </div>
            <div className="flex gap-2 px-[18px] pb-3">
              {phone && (
                <Button asChild variant="outline" className={ACTION}>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} data-testid="ticket-client-call">
                    <Phone className="h-[15px] w-[15px]" strokeWidth={2} />
                    Call
                  </a>
                </Button>
              )}
              {contactLink?.contactId && (
                <Button asChild variant="outline" className={ACTION}>
                  <Link href="/conversations" data-testid="ticket-client-message">
                    <MessageSquare className="h-[15px] w-[15px]" strokeWidth={2} />
                    Message
                  </Link>
                </Button>
              )}
              {email && (
                <Button asChild variant="outline" className={ACTION}>
                  <a href={`mailto:${email}`} data-testid="ticket-client-email">
                    <Mail className="h-[15px] w-[15px]" strokeWidth={2} />
                    Email
                  </a>
                </Button>
              )}
            </div>
            <div className="px-[18px] pb-3">
              {phone && <ContactRow icon={<Phone className="h-[15px] w-[15px]" />} text={phone} strong />}
              {email && <ContactRow icon={<Mail className="h-[15px] w-[15px]" />} text={email} />}
            </div>
            <PastTickets clientId={clientId} currentTicketId={ticket.id} />
          </>
        )}
      </div>
      <div className="flex-none border-t border-social-border px-[18px] py-3">
        <Button asChild variant="outline" className={`${OUTLINE_ACTION} h-[38px] w-full`}>
          <Link href={`/clients/${clientId}`} data-testid="ticket-open-client">
            Open client page
            <ExternalLink className="h-3.5 w-3.5 text-social-muted" />
          </Link>
        </Button>
      </div>
    </PanelShell>
  );
}
