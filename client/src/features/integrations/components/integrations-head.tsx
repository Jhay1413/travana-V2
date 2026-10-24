import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useRoles } from "@/hooks/use-role";

/** Breadcrumb, title and subtitle. */
export function IntegrationsHead() {
  const { hasAnyRole } = useRoles();
  // Branch managers cannot open /agency, so the root is plain text for them.
  const canOpenAgency = hasAnyRole(["org_admin", "platform_admin"]);
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-social-muted xl:text-[14px]">
        {canOpenAgency ? (
          <Link href="/agency" className="font-medium text-social-navy hover:underline">
            Agency
          </Link>
        ) : (
          <span className="font-medium text-social-navy">Agency</span>
        )}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span aria-current="page" className="font-semibold text-foreground">
          Integrations
        </span>
      </nav>
      <div className="min-w-[240px]">
        <h1 className="text-[22px] font-semibold leading-tight xl:text-2xl" data-testid="text-integrations-title">
          Integrations
        </h1>
        <p className="mt-1 text-[13px] text-social-muted xl:text-[14px]">
          Connect the WhatsApp, Facebook Messenger and Instagram accounts your inbox should receive messages from.
        </p>
      </div>
    </div>
  );
}
