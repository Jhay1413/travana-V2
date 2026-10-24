import type { ClientDealCounts } from "./deals";

interface StatTilesProps {
  counts: ClientDealCounts;
  isLoading: boolean;
}

export function StatTiles({ counts, isLoading }: StatTilesProps) {
  const tiles: { label: string; testId: string; value: number }[] = [
    { label: "Enquiries", testId: "client-history-enquiries", value: counts.enquiries },
    { label: "Quotes", testId: "client-history-quotes", value: counts.quotes },
    { label: "Bookings", testId: "client-history-bookings", value: counts.bookings },
  ];
  return (
    <div className="flex gap-2 px-5 pb-4">
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 flex-1 rounded-xl border border-social-border px-3 py-2.5 text-center" data-testid={t.testId}>
          <div className="text-center text-[12px] font-medium text-social-muted">{t.label}</div>
          <div className="mt-0.5 whitespace-nowrap text-center text-[20px] font-semibold leading-[1.3]">{isLoading ? "–" : String(t.value)}</div>
        </div>
      ))}
    </div>
  );
}
