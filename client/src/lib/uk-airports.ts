export const UK_DEPARTURE_AIRPORTS = [
  { code: "NCL", name: "Newcastle International" },
  { code: "MME", name: "Teesside" },
  { code: "LBA", name: "Leeds Bradford" },
  { code: "MAN", name: "Manchester" },
  { code: "EDI", name: "Edinburgh Airport" },
  { code: "GLA", name: "Glasgow Airport" },
  { code: "LHR", name: "London Heathrow" },
  { code: "LGW", name: "London Gatwick" },
  { code: "BHX", name: "Birmingham Airport" },
] as const;

export function getDepartureAirportOptions(
  airportsData: Array<{ id: string; airport_name: string; airport_code?: string | null }> | undefined
): Array<{ value: string; label: string }> {
  if (!airportsData) return [];
  const result: Array<{ value: string; label: string }> = [];
  for (const uk of UK_DEPARTURE_AIRPORTS) {
    const match = airportsData.find(
      (a) => a.airport_code?.toUpperCase() === uk.code
    );
    if (match) {
      result.push({
        value: match.id,
        label: `${uk.name} (${uk.code})`,
      });
    }
  }
  return result;
}
