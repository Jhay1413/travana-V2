import { useRole } from "@/hooks/use-role";
import AdminFinancials from "@/components/admin/admin-financials";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";

export default function AgencyForwardsPage() {
  const { can } = useRole();
  if (!can("admin", "financials")) return <OwnerOnlyGate />;

  return <AdminFinancials />;
}
