/** True for the "none" placeholder the database stores for unset choices (case-insensitive, trimmed). */
export function isNoneValue(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "none";
}

