export type TripTone = "out" | "transfer" | "hotel" | "return" | "extra" | "cruise" | "lodge";

/** Icon key; the component maps it to a lucide icon. */
export type TripIcon =
  | "plane"
  | "plane-return"
  | "bus"
  | "hotel"
  | "anchor"
  | "paw"
  | "transfer"
  | "car"
  | "ticket"
  | "coffee"
  | "parking";

export interface TripStop {
  id: string;
  kind: string;
  tone: TripTone;
  icon: TripIcon;
  /** Small uppercase label, e.g. "Outbound flight". */
  label: string;
  title: string;
  /** Detail lines under the title. */
  lines: string[];
  /** Small pills (room type, board, cabin). */
  pills: string[];
  /** Flight times, drawn as "09:15 --- 12:40". */
  route?: { depart: string; arrive: string };
  /** The flight arrives on a later day than it departs. */
  landsNextDay?: boolean;
  sortKey: string;
}
