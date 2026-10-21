import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/shared/status-pill";
import { useEnquiry, useUsers } from "@/hooks/queries";
import { currency, formatUKDate } from "@/features/quote/components/quote-types";
import { formatBudgetType } from "@/features/client/components/holiday-fields";
import { ActivityCard } from "@/features/client/components/holiday/activity-card";
import { EnquiryFacts } from "@/features/client/components/holiday/enquiry-facts";
import { EnquiryTripCard } from "@/features/client/components/holiday/enquiry-trip-card";
import { HolidayMessage, HolidayPageShell } from "@/features/client/components/holiday/holiday-page-shell";
import type { HolidayDetailBaseProps } from "@/features/client/components/holiday/holiday-detail.types";
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";
import { TopBar } from "@/features/client/components/holiday/top-bar";

/** The enquiry page: a title card, the enquiry's details and activity, and the places asked about. No money, stage or compare. */
export function EnquiryDetail(props: HolidayDetailBaseProps) {
  const { id, clientId, clientName, clientPhone, clientBadge, readOnly, onOpenExpiryDialog, onDeleted } = props;
  const { data: enquiry, isLoading, error } = useEnquiry(id);
  const { data: users = [] } = useUsers();
  const [editOpen, setEditOpen] = useState(false);

  const topBar = (
    <TopBar
      mode="enquiry"
      clientId={clientId}
      clientName={clientName}
      clientPhone={clientPhone}
      clientBadge={clientBadge}
      selection={{ type: "enquiry", id }}
      enquiryData={enquiry}
      readOnly={readOnly}
      editOpen={editOpen}
      onEditOpenChange={setEditOpen}
      onConvert={() => undefined}
      onOpenExpiryDialog={onOpenExpiryDialog}
      onDeleted={onDeleted}
    />
  );

  if (isLoading) {
    return (
      <HolidayPageShell
        topBar={topBar}
        main={
          <HolidayMessage>
            <Spinner className="mx-auto h-8 w-8" />
          </HolidayMessage>
        }
      />
    );
  }
  if (error || !enquiry) {
    return <HolidayPageShell topBar={topBar} main={<HolidayMessage>Unable to load this holiday.</HolidayMessage>} />;
  }

  const agentName = enquiry.user_id ? (users.find((u) => u.id === enquiry.user_id)?.name ?? null) : null;
  const budget = enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))}${formatBudgetType(enquiry.budget_type)}` : null;
  const lost = enquiry.status === "LOST";

  return (
    <HolidayPageShell
      topBar={topBar}
      main={
        <>
          <section className={HOLIDAY_CARD} data-testid="enquiry-title-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold leading-tight">{enquiry.title || "Untitled enquiry"}</h2>
                <p className="mt-1 text-[13px] text-qp-muted">
                  Created {enquiry.date_created ? formatUKDate(enquiry.date_created) : "—"}
                  {budget ? ` · Budget ${budget}` : ""}
                </p>
              </div>
              {enquiry.status && <StatusPill tone={lost ? "bad" : "info"}>{lost ? "Lost" : enquiry.status}</StatusPill>}
            </div>
          </section>
          <EnquiryFacts enquiry={enquiry} agentName={agentName} readOnly={readOnly} onEdit={() => setEditOpen(true)} />
          <ActivityCard
            transactionId={enquiry.transaction_id}
            entityId={id}
            entityType="enquiry"
            clientId={clientId}
            clientName={clientName}
            readOnly={readOnly}
          />
        </>
      }
      side={<EnquiryTripCard enquiry={enquiry} />}
    />
  );
}
