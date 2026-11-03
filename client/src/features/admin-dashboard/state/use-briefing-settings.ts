import { useState } from "react";
import { DEFAULT_BRIEFING_TIME, type BriefingTime } from "../lib/sample-briefing";

/** Local-only settings for the sample briefing card. Nothing is saved to the server. */
export function useBriefingSettings() {
  const [time, setTime] = useState<BriefingTime>(DEFAULT_BRIEFING_TIME);
  const [email, setEmail] = useState(true);
  return { time, setTime, email, setEmail };
}
