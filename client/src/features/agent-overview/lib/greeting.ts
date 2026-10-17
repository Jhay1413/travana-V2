export type GreetingWord = "Good morning" | "Good afternoon" | "Good evening";

/** Before noon is morning, before 6pm afternoon, otherwise evening. */
export function greetingForHour(hour: number): GreetingWord {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Good morning, James" (or just "Good morning" while the name is unknown). */
export function greetingLine(now: Date, firstName?: string | null): string {
  const word = greetingForHour(now.getHours());
  const name = (firstName ?? "").trim();
  return name ? `${word}, ${name}` : word;
}
