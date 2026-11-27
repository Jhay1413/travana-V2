import { useEffect, useRef, useState } from "react";
import type { PortalBookingDetail } from "@shared/portal-bookings";
import type { PortalPassenger } from "@shared/portal-passengers";
import { cn } from "@/lib/utils";
import { usePortalPassengers } from "../../api/use-portal-passengers";
import { passengerName, passengerStatus, passportRows, travellerLabel, type PassengerStatusTone, type PreviewTrip } from "../../lib/passport-form";
import { agentFirstName } from "../../lib/quote-format";
import { Eyebrow, PortalButton } from "../brand";
import { PassportScanner } from "./PassportScanner";

/** The design's status colours on navy. */
const STATUS_CLASS: Record<PassengerStatusTone, string> = {
  added: "text-[#F2B27A]",
  check: "text-[#FFB4A8]",
  needed: "text-white/75",
};

const STORED_NOTE = "Your passport details are stored securely and only shared with your tour operator and the airline for this booking.";

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none">
      <path d="M5 11h14v10H5zM8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function TravellerBlock({ passenger, index, agent, onScan }: { passenger: PortalPassenger; index: number; agent: string; onScan: () => void }) {
  const status = passengerStatus(passenger);
  const name = passengerName(passenger, index);
  const rows = passportRows(passenger).filter((r) => r.value);
  return (
    <div className="flex flex-col gap-4 border-t border-white/[0.18] py-6" data-testid={`passenger-${passenger.id}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.24em] text-white/60">{travellerLabel(index)}</span>
          <span className="portal-serif text-[26px] leading-[1.1] [overflow-wrap:anywhere]" data-testid="passenger-name">
            {name}
          </span>
        </div>
        <span className={cn("flex-none whitespace-nowrap pb-1 text-[10px] uppercase tracking-[0.22em]", STATUS_CLASS[status.tone])} data-testid="passenger-status">
          {status.label}
        </span>
      </div>
      {passenger.hasPassport ? (
        <>
          <dl className="grid grid-cols-2 gap-x-[18px] gap-y-4" data-testid="passenger-passport">
            {rows.map((r) => (
              <div key={r.label} className="flex min-w-0 flex-col gap-1">
                <dt className="text-[10px] uppercase tracking-[0.22em] text-white/60">{r.label}</dt>
                <dd className="portal-serif text-[19px] [overflow-wrap:anywhere]">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] leading-[1.6] text-white/80" data-testid="passenger-check">
            {passenger.check.text}
          </p>
          <PortalButton variant="link" className="self-start text-[11px] text-white hover:text-white/80" onClick={onScan} data-testid={`passenger-update-${passenger.id}`}>
            Update passport
          </PortalButton>
        </>
      ) : (
        <>
          <p className="text-sm leading-[1.6] text-white/80">We still need this passport before {agent} can finish your booking.</p>
          <PortalButton className="w-full gap-3 [&_svg]:size-5" onClick={onScan} data-testid={`passenger-add-${passenger.id}`}>
            <CameraIcon />
            Add passport
          </PortalButton>
        </>
      )}
    </div>
  );
}

/**
 * The design's navy "Passports / Snap it, we'll read it." band: one block per traveller, the full-screen scanner behind
 * "Add passport" / "Update passport" / "Add another traveller". Opens scrolled to itself when the address ends `#passports`.
 */
export function BookingPassports({ booking }: { booking: PortalBookingDetail }) {
  const { data, isLoading, isError, refetch } = usePortalPassengers();
  const sectionRef = useRef<HTMLElement>(null);
  const [scan, setScan] = useState<{ passenger: PortalPassenger | null; index: number } | null>(null);
  const [saved, setSaved] = useState("");

  const passengers = data ?? [];
  const agent = agentFirstName(booking.agent.name);
  const trip: PreviewTrip | null =
    booking.tripStatus === "upcoming" && booking.travelDate ? { destination: booking.destinationName || booking.title, departure: booking.travelDate.slice(0, 10) } : null;

  // "/portal/bookings#passports": scroll here once the rows are in (and straight away if they already are).
  const loaded = !isLoading;
  useEffect(() => {
    if (window.location.hash === "#passports") sectionRef.current?.scrollIntoView({ block: "start" });
  }, [loaded]);

  return (
    <section ref={sectionRef} id="passports" aria-labelledby="booking-passports" className="mt-14 bg-primary px-7 pb-16 pt-[72px] text-primary-foreground" data-testid="booking-passports">
      <div className="mx-auto w-full max-w-3xl">
        <Eyebrow className="mb-3.5 text-accent">Passports</Eyebrow>
        <h2 id="booking-passports" className="portal-serif mb-4 text-[38px] font-light leading-[1.08]">
          Snap it,
          <br />
          <em className="italic">we&apos;ll read it.</em>
        </h2>
        <p className="mb-7 text-[15px] leading-[1.7] text-white/[0.78]">
          Take a photo of the photo page of each passport. We&apos;ll read the details for you to check, so there&apos;s nothing to type.
        </p>

        {isLoading && (
          <div className="animate-pulse border-t border-white/[0.18] py-6" role="status" aria-label="Loading your travellers" data-testid="passengers-loading">
            <div className="h-3 w-24 bg-white/15" />
            <div className="mt-3 h-7 w-1/2 bg-white/15" />
          </div>
        )}

        {isError && (
          <div role="alert" className="border-t border-white/[0.18] py-6" data-testid="passengers-error">
            <p className="text-sm leading-[1.6] text-white/80">We couldn&apos;t load your passport details.</p>
            <PortalButton variant="link" className="text-[11px] text-white hover:text-white/80" onClick={() => void refetch()} data-testid="passengers-retry">
              Try again
            </PortalButton>
          </div>
        )}

        {!isLoading && !isError &&
          passengers.map((p, i) => <TravellerBlock key={p.id} passenger={p} index={i} agent={agent} onScan={() => setScan({ passenger: p, index: i })} />)}

        {!isLoading && !isError && (
          <div className="border-t border-white/[0.18] pt-2">
            <PortalButton
              variant="link"
              className="self-start text-[11px] text-white hover:text-white/80"
              onClick={() => setScan({ passenger: null, index: passengers.length })}
              data-testid="passenger-add-another"
            >
              Add another traveller
            </PortalButton>
          </div>
        )}

        <div className="border-t border-white/[0.18]" />
        <p className="mt-5 flex items-start gap-2.5 text-xs leading-[1.6] text-white/[0.68]">
          <LockIcon />
          <span data-testid="passports-lock-note">{STORED_NOTE}</span>
        </p>
        <p role="status" className="sr-only">
          {saved}
        </p>
      </div>

      <PassportScanner
        open={scan !== null}
        passenger={scan?.passenger ?? null}
        whoLabel={scan ? travellerLabel(scan.index) : ""}
        trip={trip}
        agent={agentFirstName(booking.agent.name, "")}
        onClose={() => setScan(null)}
        onSaved={(name) => {
          setScan(null);
          setSaved(`Passport saved for ${name}.`);
        }}
      />
    </section>
  );
}
