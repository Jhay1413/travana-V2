import { HomeCard } from "@/features/agent-overview";
import { CardHead, CardNote, StatusPill } from "@/features/admin-dashboard";
import { useAgentProfilePayouts } from "../../api/use-agent-profile-queries";
import { buildPayoutViews, payoutsSubtitle } from "../../lib/payouts-model";
import { gbp2 } from "../../lib/money";
import { EmptyBlock, TD, TH } from "../shared/profile-bits";

/** Homeworker payouts, one row per month. Owners and admins only; the page never mounts it for others. */
export function PayoutsCard({ userId, className }: { userId: string; className?: string }) {
  const payouts = useAgentProfilePayouts(userId, true);
  const rows = buildPayoutViews(payouts.data?.rows ?? []);

  return (
    <HomeCard className={className} testId="agent-profile-payouts">
      <CardHead id="payouts-title" title="Payouts" sub={payoutsSubtitle(payouts.data?.sharePercent ?? null)} />
      {payouts.isError ? (
        <CardNote tone="error" testId="payouts-error">
          We could not load the payouts.
        </CardNote>
      ) : payouts.isLoading ? (
        <CardNote>Loading...</CardNote>
      ) : rows.length === 0 ? (
        <EmptyBlock title="No payouts yet">Monthly payouts will be listed here.</EmptyBlock>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse" data-testid="table-payouts">
            <caption className="sr-only">Monthly payouts to the homeworker</caption>
            <thead>
              <tr className="border-b border-social-border">
                <th scope="col" className={`${TH} text-left`}>
                  Month
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Amount
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className={TD}>
                    {r.month}
                    <div className="text-[12px] text-social-muted">{r.sub}</div>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{r.amount === null ? "—" : gbp2(r.amount)}</td>
                  <td className={TD}>
                    <StatusPill tone={r.tone}>{r.statusLabel}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HomeCard>
  );
}
