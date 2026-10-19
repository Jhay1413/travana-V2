import { buildEarningsTiles } from "../../lib/earnings-model";
import type { AgentProfileHeader, AgentProfilePerformance } from "../../types";
import { Tile, TileRow } from "../shared/profile-bits";

export function EarningsTiles({ header, perf }: { header: AgentProfileHeader; perf: AgentProfilePerformance }) {
  const tiles = buildEarningsTiles(header, perf);
  return (
    <TileRow label="Earnings for the period" testId="agent-profile-earnings-tiles">
      {tiles.map((t) => (
        <Tile key={t.label} label={t.label} value={t.value} sub={t.sub} />
      ))}
    </TileRow>
  );
}
