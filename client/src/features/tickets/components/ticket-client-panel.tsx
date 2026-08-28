import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Globe,
  Hash,
  Hotel,
  Mail,
  MapPin,
  MoonStar,
  Phone,
  PlaneTakeoff,
  Tag,
  User,
  Utensils,
} from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useBooking, useClient } from "@/hooks/queries";
import { clientDisplayName, cn } from "@/lib/utils";
import type { Ticket } from "../types";

// Right panel of the tickets inbox — "Client Details". Same visual language as
// the conversations inbox's ContactPanel client block (grey label / red icon /
// bold value), replicated locally since ClientField isn't part of the
// conversations feature's public surface.

// The v2 `/api/v2/clients/:id` endpoint (useClient) returns the raw
// client_table row, not the flattened `Client` shape (`name`/`phone`) the rest
// of the client feature was typed against — read the real columns and cast
// around the stale type rather than trust `client.name`/`client.phone`.
interface RawClientRow {
  title?: string | null;
  firstName?: string | null;
  surename?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  createdAt?: string | null;
}

function ClientField({ label, icon: Icon, value, href }: { label: string; icon: typeof User; value: string; href?: string }) {
  return (
    <div>
      <div className="text-xs text-black/45 dark:text-white/45">{label}</div>
      <div className="mt-1 flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-[#ff0000]" strokeWidth={1.25} />
        {href ? (
          <Link
            href={href}
            className="truncate text-sm font-bold text-sky-600 hover:underline 3xl:text-base dark:text-sky-400"
            data-testid="ticket-client-name-link"
          >
            {value}
          </Link>
        ) : (
          <span className="truncate text-sm font-bold 3xl:text-base">{value}</span>
        )}
      </div>
    </div>
  );
}

function memberSince(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// "03 March, 2027" — the design's Travel Date format.
function formatBookingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  return `${day} ${month}, ${d.getFullYear()}`;
}

// Collapsible "Booking" block under the client details — default open, bold
// header + chevron, same ClientField rows as the client block above. Only
// fields that actually exist on the fetched EnrichedBooking are rendered.
function BookingSection({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(true);
  const { data: booking, isLoading } = useBooking(bookingId);

  if (isLoading && !booking) {
    return <p className="text-xs text-black/45 dark:text-white/45">Loading booking…</p>;
  }
  if (!booking) return null;

  const primaryAccommodation = booking.accommodations?.find((a) => a.is_primary) ?? booking.accommodations?.[0];
  // The booking detail payload carries the departure airport per flight as
  // "Newcastle International (NCL)" — take the earliest flight's and reshape to
  // the design's "Newcastle International, NCL".
  const flights = (booking as { flights?: Array<{ departing_airport_name?: string | null; departure_date_time?: string | null }> }).flights ?? [];
  const firstFlight = [...flights].sort(
    (a, b) => new Date(a.departure_date_time || 0).getTime() - new Date(b.departure_date_time || 0).getTime(),
  )[0];
  const airport = firstFlight?.departing_airport_name
    ? firstFlight.departing_airport_name.replace(/\s*\(([^)]+)\)\s*$/, ", $1")
    : null;
  const nights =
    booking.num_of_nights != null ? `${booking.num_of_nights} Night${booking.num_of_nights === 1 ? "" : "s"}` : null;

  // Icon set from Icons.txt ("Quote Templates"), kept in the panel's red style.
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-black/10 pt-5 dark:border-white/10">
      <CollapsibleTrigger
        className="flex w-full items-center justify-between"
        data-testid="ticket-booking-section-trigger"
      >
        <h3 className="text-[13px] font-bold 3xl:text-sm">Booking</h3>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-black/45 transition-transform dark:text-white/45", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-5">
        {booking.hays_ref && <ClientField label="HAYS Number" icon={Hash} value={booking.hays_ref} />}
        {booking.supplier_ref && <ClientField label="Tour Operator Reference" icon={Globe} value={booking.supplier_ref} />}
        {booking.title && <ClientField label="Booking Name" icon={Tag} value={booking.title} />}
        {formatBookingDate(booking.travel_date) && (
          <ClientField label="Travel Date" icon={CalendarDays} value={formatBookingDate(booking.travel_date)!} />
        )}
        {nights && <ClientField label="Number Nights" icon={MoonStar} value={nights} />}
        {airport && <ClientField label="Departure Airport" icon={PlaneTakeoff} value={airport} />}
        {booking.destination_name && <ClientField label="Destination" icon={MapPin} value={booking.destination_name} />}
        {primaryAccommodation?.accomodation_name && (
          <ClientField label="Hotel" icon={Hotel} value={primaryAccommodation.accomodation_name} />
        )}
        {primaryAccommodation?.board_basis_name && (
          <ClientField label="Board" icon={Utensils} value={primaryAccommodation.board_basis_name} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TicketClientPanel({ ticket }: { ticket: Ticket | null | undefined }) {
  const { data: client, isLoading } = useClient(ticket?.clientId ?? "");
  const raw = client as unknown as RawClientRow | undefined;

  const name = (raw && clientDisplayName(raw)) || ticket?.clientName || null;
  const contact = raw?.phoneNumber || raw?.email || null;
  const contactIcon = raw?.phoneNumber ? Phone : Mail;
  const since = memberSince(raw?.createdAt);

  return (
    <Card className="flex flex-col overflow-hidden rounded-none border-0 border-l border-black/10 bg-white p-0 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-4 3xl:px-6 dark:border-white/10">
        <h2 className="text-[15px] font-semibold 3xl:text-[17px]">Client Details</h2>
      </div>

      <div className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="space-y-5 px-4 py-5 3xl:px-6">
          {!ticket ? (
            <p className="text-xs text-black/45 dark:text-white/45">Select a ticket to see client details.</p>
          ) : !ticket.clientId ? (
            <p className="text-xs text-black/45 dark:text-white/45">This is an internal ticket — no client is linked.</p>
          ) : isLoading && !name ? (
            <p className="text-xs text-black/45 dark:text-white/45">Loading client…</p>
          ) : name ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <ClientField label="Name" icon={User} value={name} href={`/clients/${ticket.clientId}`} />
                <span
                  className="mt-0.5 shrink-0 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white"
                  data-testid="ticket-client-linked-badge"
                >
                  Linked
                </span>
              </div>
              {contact && <ClientField label="Contact" icon={contactIcon} value={contact} />}
              {since && <ClientField label="Member Since" icon={CalendarDays} value={since} />}
              {ticket.bookingId && <BookingSection bookingId={ticket.bookingId} />}
            </>
          ) : (
            <p className="text-xs text-black/45 dark:text-white/45">Couldn't load this client's details.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
