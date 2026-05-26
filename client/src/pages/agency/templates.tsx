import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";
import { SmsTemplatesManager } from "@/components/sms/templates-manager";

export default function AgencyTemplatesPage() {
  const { can } = useRole();
  if (!can("admin", "sms")) return <OwnerOnlyGate />;

  return <SmsTemplatesManager />;
}
