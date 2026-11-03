import { AdminProgress } from "@/features/admin-dashboard";
import { BENCHMARK_COMMISSION_RATE, buildHealthCopy } from "../../lib/health-copy";
import type { AgentProfilePerformance } from "../../types";
import { Tile, TileRow } from "../shared/profile-bits";

/** Quote views, close rate and average commission rate for the chosen period. */
export function HealthTiles({ perf }: { perf: AgentProfilePerformance }) {
  const copy = buildHealthCopy(perf);
  return (
    <TileRow label="Sales health" testId="agent-profile-health">
      <Tile label="Quote views" value={copy.views.value} unit="views" sub={copy.views.sub} testId="health-views" />
      <Tile label="Close rate" value={copy.closeRate.value} sub={copy.closeRate.sub} testId="health-close-rate" />
      <Tile label="Average commission rate" value={copy.commission.value} sub={copy.commission.sub} testId="health-commission-rate">
        <AdminProgress
          pct={copy.commission.barPct}
          tone="navy"
          label={`Average commission rate against ${BENCHMARK_COMMISSION_RATE} percent`}
          testId="progress-commission-rate"
          ariaNow={copy.commission.ariaNow}
          ariaMax={BENCHMARK_COMMISSION_RATE}
          className="mt-1"
        />
      </Tile>
    </TileRow>
  );
}
