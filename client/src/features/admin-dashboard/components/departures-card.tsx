import { Segmented } from "@/components/ui/segmented";
import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import { DEPARTURES, deriveRows, needsActionCount, summaryLine } from "../lib/sample-departures";
import { useDeparturesState, type DepartureShow } from "../state/use-departures-state";
import { DepartureRow } from "./departure-row";
import { CardHead } from "./shared/bits";
import { SamplePill } from "./shared/pills";

/** SAMPLE content: prototype departures, interactive locally only. No server calls. */
export function DeparturesCard({ className }: { className?: string }) {
  const { done, show, setShow, toggle } = useDeparturesState();
  const rows = deriveRows(done);
  const shown = show === "act" ? rows.filter((r) => r.hasAction) : rows;

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="card-departures">
      <CardHead
        id="departures-title"
        title="Departures and balances"
        pill={<SamplePill />}
        sub="Next 7 days, to Friday 23 October"
        right={
          <Segmented<DepartureShow>
            value={show}
            onChange={setShow}
            variant="black"
            label="Show departures"
            items={[
              { value: "all", label: `All ${DEPARTURES.length}`, testId: "segment-departures-all" },
              { value: "act", label: `Needs action ${needsActionCount(done)}`, testId: "segment-departures-action" },
            ]}
          />
        }
      />
      <p className="mb-3 text-[13px] font-medium xl:text-[14px]" role="status" data-testid="text-departures-summary">
        {summaryLine(done)}
      </p>
      <div>
        {shown.map((row) => (
          <DepartureRow key={row.dep.id} row={row} onToggle={toggle} />
        ))}
      </div>
    </HomeCard>
  );
}
