import { useState } from "react";
import { requestErrorMessage } from "@/lib/request-error";
import { Segmented } from "@/components/ui/segmented";
import { BALANCES_PATH, TICKETS_PATH, addDays, formatTravelDate, todayKey, useDepartures, useDepartureSummary } from "@/features/departures";
import { HomeCard, HomeLink } from "@/features/agent-overview/components/home/home-ui";
import { cardSummaryLine, needsAction, summaryFromRows } from "../lib/departure-pill";
import { useNow } from "../state/use-now";
import { DepartureCardRow } from "./departure-row";
import { CardHead, CardNote } from "./shared/bits";

type Show = "all" | "act";

/** "Next N days" includes day N: the list is asked for [today, today + N + 1). */
const WINDOW_DAYS = 7;

/** Next 7 days of departures (live): status per trip, with links to the full tickets and balances lists. */
export function DeparturesCard({ className }: { className?: string }) {
  const [show, setShow] = useState<Show>("all");
  const today = todayKey(useNow());
  const list = useDepartures({ to: addDays(today, WINDOW_DAYS + 1) });
  const summary = useDepartureSummary(WINDOW_DAYS);

  const rows = list.data ?? [];
  const actionCount = rows.filter((r) => needsAction(r.checks)).length;
  const shown = show === "act" ? rows.filter((r) => needsAction(r.checks)) : rows;
  const counts = summary.data ?? summaryFromRows(rows);

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="card-departures">
      <CardHead
        id="departures-title"
        title="Departures and balances"
        sub={`Next 7 days, to ${formatTravelDate(addDays(today, WINDOW_DAYS))}`}
        right={
          <Segmented
            value={show}
            onChange={setShow}
            variant="black"
            label="Show departures"
            items={[
              { value: "all", label: `All ${rows.length}`, testId: "segment-departures-all" },
              { value: "act", label: `Needs action ${actionCount}`, testId: "segment-departures-action" },
            ]}
          />
        }
      />
      {list.isError ? (
        <CardNote tone="error" testId="text-departures-error">
          {requestErrorMessage(list.error, "Couldn't load departures. Please try again in a moment.")}
        </CardNote>
      ) : !list.data ? (
        <CardNote testId="text-departures-loading">Loading departures…</CardNote>
      ) : (
        <>
          <p className="mb-3 text-[13px] font-medium xl:text-[14px]" role="status" data-testid="text-departures-summary">
            {cardSummaryLine(counts)}
          </p>
          <div className="mb-2 flex flex-wrap gap-4">
            <HomeLink href={TICKETS_PATH} testId="link-departures-tickets">
              Open the tickets list
            </HomeLink>
            <HomeLink href={BALANCES_PATH} testId="link-departures-balances">
              Open the balances list
            </HomeLink>
          </div>
          {shown.length === 0 ? (
            <CardNote testId="text-departures-empty">{rows.length === 0 ? "No departures in the next 7 days." : "Nothing needs action."}</CardNote>
          ) : (
            <div>
              {shown.map((row) => (
                <DepartureCardRow key={row.bookingId} row={row} />
              ))}
            </div>
          )}
        </>
      )}
    </HomeCard>
  );
}
