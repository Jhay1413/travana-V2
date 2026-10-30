import { useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import type { NeonClient } from "@/features/client/types/neon-client";
import type { ClientPassenger } from "@/features/client/api/client-passenger.api";
import { useClientPassengers } from "@/features/client/api/use-client-passengers";
import { composeAddress } from "@/features/client/lib/compose-address";
import {
  RIGHT_CARD_TABS,
  formatPassengerDate,
  orDash,
  passengerCountLabel,
  passengerFullName,
  passengerLabel,
  passportFootnote,
  type RightCardTab,
} from "@/features/client/lib/client-passengers";
import { CARD_CLASS } from "./card-head";
import { PassengerModal } from "./modals/passenger-modal";
import { PortalAccessPanel, ReferralNetworkPanel } from "./side-cards";

function InfoRow({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex gap-3 text-[13px]" data-testid={testId}>
      <span className="w-20 shrink-0 text-social-muted">{label}</span>
      <span className="min-w-0 flex-1 break-words font-medium">{children}</span>
    </div>
  );
}

function PassengerCard({ passenger, index, readOnly, onEdit }: { passenger: ClientPassenger; index: number; readOnly: boolean; onEdit: () => void }) {
  return (
    <div className="rounded-xl border border-social-border bg-card p-4" data-testid={`passenger-card-${passenger.id ?? "lead"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-[11px] font-bold uppercase tracking-wide", passenger.isLead ? "text-social-orange-text" : "text-sky-600")}>
            {passengerLabel(passenger, index)}
          </div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">{passengerFullName(passenger) || "—"}</div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${passengerFullName(passenger)}`}
            title="Edit"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-social-border text-social-muted transition hover:bg-muted hover:text-foreground"
            data-testid={`passenger-edit-${passenger.id ?? "lead"}`}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-1.5">
        <InfoRow label="D.O.B">{formatPassengerDate(passenger.dateOfBirth)}</InfoRow>
        <InfoRow label="Passport number">{orDash(passenger.passportNumber)}</InfoRow>
        <InfoRow label="Passport expiry">
          <span className="flex flex-wrap items-center gap-2">
            {formatPassengerDate(passenger.passportExpiry)}
            {passenger.passportWarning && (
              <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]" data-testid="passenger-passport-warning">
                Under 6 months at travel
              </span>
            )}
          </span>
        </InfoRow>
      </div>
    </div>
  );
}

function ClientDetailsPanel({
  clientId,
  clientData,
  readOnly,
  onEditClient,
}: {
  clientId: string;
  clientData: NeonClient | undefined;
  readOnly: boolean;
  onEditClient: () => void;
}) {
  const { data, isLoading, isError } = useClientPassengers(clientId);
  const [modal, setModal] = useState<{ open: boolean; passenger: ClientPassenger | null }>({ open: false, passenger: null });
  const passengers = data?.passengers ?? [];

  return (
    <div data-testid="client-details-panel">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold">Contact</h3>
        {!readOnly && (
          <button type="button" onClick={onEditClient} className="inline-flex items-center gap-1 text-[13px] font-semibold text-social-orange-text transition hover:underline" data-testid="client-details-edit">
            <Pencil className="h-3 w-3" strokeWidth={2} /> Edit
          </button>
        )}
      </div>
      <div className="mt-2.5 grid gap-2 rounded-xl bg-[#F1F4F8] p-4 dark:bg-muted" data-testid="client-details-contact">
        <InfoRow label="Address">{orDash(composeAddress(clientData))}</InfoRow>
        <InfoRow label="Email">{orDash(clientData?.email)}</InfoRow>
        <InfoRow label="Phone">{orDash(clientData?.phoneNumber)}</InfoRow>
      </div>

      <div className="mb-2.5 mt-6 flex items-center gap-2.5">
        <h3 className="text-[15px] font-semibold">Passengers</h3>
        {!isLoading && !isError && (
          <span className="rounded-full bg-[#F1F4F8] px-2.5 py-0.5 text-[11px] font-semibold text-social-muted dark:bg-muted" data-testid="passenger-count">
            {passengerCountLabel(passengers.length)}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" data-testid="passengers-loading" />
      ) : isError ? (
        <p className="text-[13px] text-destructive" data-testid="passengers-error">Could not load passengers.</p>
      ) : (
        <div className="grid gap-3">
          {passengers.map((p, i) => (
            <PassengerCard key={p.id ?? "lead"} passenger={p} index={i} readOnly={readOnly} onEdit={() => setModal({ open: true, passenger: p })} />
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setModal({ open: true, passenger: null })}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-social-orange-text/60 text-[13px] font-semibold text-social-orange-text transition hover:bg-social-orange/10"
              data-testid="button-add-passenger"
            >
              <Plus className="h-4 w-4" /> Add passenger
            </button>
          )}
          <p className="text-xs text-social-muted" data-testid="passenger-footnote">
            {passportFootnote(data?.nextDeparture ?? null)}
          </p>
        </div>
      )}

      <PassengerModal clientId={clientId} open={modal.open} onOpenChange={(open) => setModal((m) => ({ ...m, open }))} passenger={modal.passenger} />
    </div>
  );
}

interface ClientDetailsCardProps {
  clientId: string;
  clientData: NeonClient | undefined;
  readOnly: boolean;
  onEditClient: () => void;
  onChangePin: () => void;
}

/** Right-hand card: Client details (contact + passengers), Portal access and Referral network. */
export function ClientDetailsCard({ clientId, clientData, readOnly, onEditClient, onChangePin }: ClientDetailsCardProps) {
  const [tab, setTab] = useState<RightCardTab>("details");

  return (
    <section className={CARD_CLASS} data-testid="client-index-side-card">
      <Segmented
        value={tab}
        onChange={setTab}
        items={RIGHT_CARD_TABS.map((t) => ({ value: t.value, label: t.label, testId: `client-side-tab-${t.value}` }))}
        height={42}
        label="Client sections"
        className="mb-5 w-full"
        itemClassName="flex-1 px-2"
      />
      {tab === "details" && <ClientDetailsPanel clientId={clientId} clientData={clientData} readOnly={readOnly} onEditClient={onEditClient} />}
      {tab === "portal" && <PortalAccessPanel clientId={clientId} readOnly={readOnly} onChangePin={onChangePin} />}
      {tab === "referrals" && <ReferralNetworkPanel clientId={clientId} />}
    </section>
  );
}
