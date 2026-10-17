/** Short label shown beside time inputs: "UK time" for London, otherwise the IANA name. */
export function timezoneLabel(timezone: string): string {
  return timezone === "Europe/London" ? "UK time" : timezone;
}
