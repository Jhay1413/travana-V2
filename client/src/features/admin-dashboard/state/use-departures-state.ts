import { useState } from "react";
import type { DoneMap } from "../lib/sample-departures";

export type DepartureShow = "all" | "act";

/** Local-only state for the sample departures card: which rows were chased and the All / Needs action view. */
export function useDeparturesState() {
  const [done, setDone] = useState<DoneMap>({});
  const [show, setShow] = useState<DepartureShow>("all");

  const toggle = (id: string) => setDone((prev) => ({ ...prev, [id]: !prev[id] }));

  return { done, show, setShow, toggle };
}
