import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { breadcrumbFor } from "../../lib/profile-tabs";

const LINK = "font-medium text-social-navy hover:underline";

/** "Admin Dashboard > Team performance > Tina" (branch managers: "Dashboard > Agents > Tina"). */
export function ProfileBreadcrumb({ isAdmin, name }: { isAdmin: boolean; name: string }) {
  const b = breadcrumbFor(isAdmin);
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-social-muted xl:text-[14px]" data-testid="agent-profile-breadcrumb">
      <Link href={b.rootHref} className={LINK}>
        {b.rootLabel}
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      <Link href={b.parentHref} className={LINK}>
        {b.parentLabel}
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      <span aria-current="page" className="font-semibold text-foreground">
        {name}
      </span>
    </nav>
  );
}
