import { Link } from "wouter";
import { HomeCard } from "@/features/agent-overview";
import { CardHead, CardNote, gbp } from "@/features/admin-dashboard";
import { dealTypeHref } from "@/lib/deal-links";
import { useAgentProfileBiggestDeals } from "../../api/use-agent-profile-queries";
import { dayKeyOf, formatDay } from "../../lib/dates";
import { EmptyBlock, TD, TH } from "../shared/profile-bits";

/** The five bookings with the most commission, all time. */
export function BiggestDealsCard({ userId, className }: { userId: string; className?: string }) {
  const deals = useAgentProfileBiggestDeals(userId, 5);
  const rows = deals.data ?? [];

  return (
    <HomeCard className={className} testId="agent-profile-biggest-deals">
      <CardHead id="biggest-deals-title" title="Biggest deals" />
      {deals.isError ? (
        <CardNote tone="error" testId="biggest-deals-error">
          We could not load the biggest deals.
        </CardNote>
      ) : deals.isLoading ? (
        <CardNote>Loading...</CardNote>
      ) : rows.length === 0 ? (
        <EmptyBlock title="No deals yet">Their biggest bookings will be listed here.</EmptyBlock>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse" data-testid="table-biggest-deals">
            <caption className="sr-only">Biggest deals by profit</caption>
            <thead>
              <tr className="border-b border-social-border">
                <th scope="col" className={`${TH} text-left`}>
                  Deal
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Booked
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Booking value
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.bookingId} data-testid={`row-deal-${d.bookingId}`}>
                  <td className={TD}>
                    <Link href={dealTypeHref("booking", d.bookingId, d.clientId)} className="font-semibold text-social-navy hover:underline">
                      {d.title || d.clientName || "Booking"}
                    </Link>
                    {d.clientName && d.title && <div className="text-[12px] text-social-muted">{d.clientName}</div>}
                  </td>
                  <td className={TD}>{d.bookedAt ? formatDay(dayKeyOf(d.bookedAt)) : "—"}</td>
                  <td className={`${TD} text-right tabular-nums`}>{gbp(d.salesPrice)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{gbp(d.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HomeCard>
  );
}
