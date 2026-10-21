import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

/**
 * Breadcrumb trail: Home, the client, then the current kind.
 * Props: clientId (links the client crumb to /clients/:id), clientName, kind (the current crumb).
 */
export interface BreadcrumbProps {
  clientId: string;
  clientName: string;
  kind: "Quote" | "Booking" | "Enquiry";
}

const LINK = "font-medium text-social-navy hover:underline";

export function Breadcrumb({ clientId, clientName, kind }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-qp-muted" data-testid="holiday-breadcrumb">
      <Link href="/" className={LINK}>
        Home
      </Link>
      <ChevronRight className="size-3" aria-hidden />
      <Link href={`/clients/${clientId}`} className={LINK}>
        {clientName}
      </Link>
      <ChevronRight className="size-3" aria-hidden />
      <span aria-current="page">{kind}</span>
    </nav>
  );
}
