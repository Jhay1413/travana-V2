import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { useMediaQuery } from "@/hooks/use-media-query";
import { daysAway, todayKey } from "../../lib/day-labels";
import { CHECK_STEPS } from "../../lib/stamp";
import {
  ALL_OPTION,
  distinctSorted,
  filterTickets,
  ticketCounts,
  ticketEmpty,
  ticketStatusLine,
  type TicketShow,
} from "../../lib/ticket-rows";
import type { DepartureCheckKey, DepartureRow } from "../../types";
import { FilterSelect, LIST_CARD, ListEmptyState, ListHead, SearchBox, TH, TH_CENTER, Toolbar } from "../shared/list-bits";
import { TicketCard } from "./ticket-card";
import { TicketRow } from "./ticket-row";

/** The Tickets tab: one row per trip with live tick boxes. */
export function TicketsList({
  rows,
  onCheck,
}: {
  rows: DepartureRow[];
  onCheck: (row: DepartureRow, key: DepartureCheckKey, value: boolean) => void;
}) {
  const narrow = useMediaQuery("(max-width: 860px)");
  const [show, setShow] = useState<TicketShow>("todo");
  const [query, setQuery] = useState("");
  const [operator, setOperator] = useState(ALL_OPTION);
  const today = todayKey();

  const operators = useMemo(() => distinctSorted(rows.map((r) => r.operatorName)), [rows]);
  const counts = ticketCounts(rows, today);
  const filters = { show, query, operator };
  const shown = filterTickets(rows, filters);

  return (
    <section className={LIST_CARD} aria-labelledby="tickets-title" data-testid="card-tickets">
      <ListHead id="tickets-title" title="Tickets" status={ticketStatusLine(counts)} testId="text-tickets-status" />
      <Toolbar>
        <Segmented
          value={show}
          onChange={setShow}
          variant="black"
          label="Show"
          items={[
            { value: "todo", label: `To do ${counts.todo}`, testId: "segment-tickets-todo" },
            { value: "done", label: `Completed ${counts.done}`, testId: "segment-tickets-done" },
            { value: "all", label: `All ${counts.total}`, testId: "segment-tickets-all" },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search client or destination" testId="input-tickets-search" />
        <FilterSelect value={operator} onChange={setOperator} allLabel="All tour operators" options={operators} label="Tour operator" testId="select-tickets-operator" />
      </Toolbar>

      {shown.length === 0 ? (
        <ListEmptyState empty={ticketEmpty(filters)} />
      ) : narrow ? (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <TicketCard key={r.bookingId} row={r} days={daysAway(r.travelDate, today)} onCheck={onCheck} />
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse">
            <caption className="sr-only">Tickets checklist for each departure, sorted by travel date</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>Client name</th>
                <th scope="col" className={TH}>Travel date</th>
                <th scope="col" className={TH}>Tour operator</th>
                <th scope="col" className={TH}>Destination</th>
                {CHECK_STEPS.map((s) => (
                  <th scope="col" className={TH_CENTER} key={s.key}>
                    {s.label}
                  </th>
                ))}
                <th scope="col" className={TH_CENTER}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <TicketRow key={r.bookingId} row={r} days={daysAway(r.travelDate, today)} onCheck={onCheck} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-social-muted">Completed unlocks once all four checks are ticked. Unticking a check reopens the trip.</p>
    </section>
  );
}
