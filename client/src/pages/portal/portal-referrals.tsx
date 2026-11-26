import { RewardsView } from "@/features/portal";
import PortalLayout from "./portal-layout";

/** Portal Rewards (referrals, wallet, withdrawals) in the new look. Everything lives in features/portal (RewardsView). */
export default function PortalReferralsPage() {
  return (
    <PortalLayout tone="light">
      <RewardsView />
    </PortalLayout>
  );
}
