import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { useMediaQuery } from "@/hooks/use-media-query";
import { balanceCounts, balanceEmpty, balanceStatusLine, filterBalances, type BalanceShow } from "../../lib/balance-rows";
import { daysAway, todayKey } from "../../lib/day-labels";
import { ALL_OPTION, distinctSorted } from "../../lib/ticket-rows";
import type { DepartureCheckKey, DepartureRow } from "../../types";
import { FilterSelect, LIST_CARD, ListEmptyState, ListHead, SearchBox, TH, TH_CENTER, Toolbar } from "../shared/list-bits";
import { BalanceCard, BalanceRow } from "./balance-row";

/** The Balances tab: one row per booking with a Fully paid tick. */
export function BalancesList({
  rows,
  onCheck,
}: {
  rows: DepartureRow[];
  onCheck: (row: DepartureRow, key: DepartureCheckKey, value: boolean) => void;
}) {
  const narrow = useMediaQuery("(max-width: 860px)");
  const [show, setShow] = useState<BalanceShow>("unpaid");
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState(ALL_OPTION);
  const today = todayKey();

  const suppliers = useMemo(() => distinctSorted(rows.map((r) => r.operatorName)), [rows]);
  const counts = balanceCounts(rows, today);
  const filters = { show, query, supplier };
  const shown = filterBalances(rows, filters);

  return (
    <section className={LIST_CARD} aria-labelledby="balances-title" data-testid="card-balances">
      <ListHead id="balances-title" title="Balances" status={balanceStatusLine(counts)} testId="text-balances-status" />
      <Toolbar>
        <Segmented
          value={show}
          onChange={setShow}
          variant="black"
          label="Show"
          items={[
            { value: "unpaid", label: `Not paid ${counts.unpaid}`, testId: "segment-balances-unpaid" },
            { value: "paid", label: `Fully paid ${counts.paid}`, testId: "segment-balances-paid" },
            { value: "all", label: `All ${counts.total}`, testId: "segment-balances-all" },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search HAY ref, passenger or destination" testId="input-balances-search" />
        <FilterSelect value={supplier} onChange={setSupplier} allLabel="All suppliers" options={suppliers} label="Supplier" testId="select-balances-supplier" />
      </Toolbar>

      {shown.length === 0 ? (
        <ListEmptyState empty={balanceEmpty(filters)} />
      ) : narrow ? (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <BalanceCard key={r.bookingId} row={r} days={daysAway(r.travelDate, today)} onCheck={onCheck} />
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse">
            <caption className="sr-only">Balances for each booking, sorted by departure date</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>HAY Ref no.</th>
                <th scope="col" className={TH}>Departure date</th>
                <th scope="col" className={TH}>Lead passenger</th>
                <th scope="col" className={TH}>Destination</th>
                <th scope="col" className={TH}>Supplier</th>
                <th scope="col" className={TH_CENTER}>Fully paid</th>
                <th scope="col" className={TH}>Last change</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <BalanceRow key={r.bookingId} row={r} days={daysAway(r.travelDate, today)} onCheck={onCheck} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
