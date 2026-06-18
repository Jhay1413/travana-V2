import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { SmsTemplatesManager } from "@/features/sms/components/sms/templates-manager";

export default function AgencyTemplatesPage() {
  const { can } = useRole();
  if (!can("admin", "sms")) return <OwnerOnlyGate />;

  return <SmsTemplatesManager />;
}
