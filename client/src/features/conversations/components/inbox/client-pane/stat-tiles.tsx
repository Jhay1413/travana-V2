import type { ClientMoneyStats } from "./deals";

interface StatTilesProps {
  stats: ClientMoneyStats;
  isLoading: boolean;
}

const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export function formatStatMoney(value: number): string {
  return value === 0 ? "—" : currency.format(value);
}

export function StatTiles({ stats, isLoading }: StatTilesProps) {
  const tiles: { label: string; testId: string; value: string }[] = [
    { label: "Bookings", testId: "client-history-bookings", value: String(stats.bookings) },
    { label: "Profit", testId: "client-history-profit", value: formatStatMoney(stats.profit) },
    { label: "Spend", testId: "client-history-spend", value: formatStatMoney(stats.spend) },
  ];
  return (
    <div className="flex gap-2 px-5 pb-4">
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 flex-1 rounded-xl border border-social-border px-3 py-2.5" data-testid={t.testId}>
          <div className="text-[12px] font-medium text-social-muted">{t.label}</div>
          <div className="mt-0.5 whitespace-nowrap text-[20px] font-semibold leading-[1.3]">{isLoading ? "–" : t.value}</div>
        </div>
      ))}
    </div>
  );
}
