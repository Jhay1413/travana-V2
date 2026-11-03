import { Link, useLocation } from "wouter";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrentOrganization } from "@/features/organization/api/use-organization-queries";
import { useRole } from "@/hooks/use-role";
import { useDepartures } from "../api/use-departures";
import { londonLongDate } from "../lib/day-labels";
import { breadcrumbRoot, tabCounts, tabFromPath, tabPath } from "../lib/tabs";
import { useCheckHandler } from "../state/use-check-handler";
import { BalancesList } from "./balances/balances-list";
import { DeparturesTabs } from "./departures-tabs";
import { TicketsList } from "./tickets/tickets-list";

/** /agency/departures and /agency/departures/balances: the full lists behind the dashboard card. */
export function DeparturesPage() {
  const [path, navigate] = useLocation();
  const tab = tabFromPath(path);
  const { orgRole } = useRole();
  const { data: org } = useCurrentOrganization();
  const { data: rows, isLoading, isError, error } = useDepartures();
  const onCheck = useCheckHandler();

  const root = breadcrumbRoot(orgRole === "org_admin" || orgRole === "platform_admin");
  const date = londonLongDate();
  const subline = [org?.name, date, "Ticks save straight away and everyone sees the same list"].filter(Boolean).join(" · ");

  return (
    <div className="text-compact -m-4 flex min-h-full min-w-0 flex-col gap-5 bg-social-page p-4 md:-m-6 md:p-6" data-testid="departures-page">
      <div className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] text-social-muted xl:text-[14px]" data-testid="departures-breadcrumb">
          <Link href={root.href} className="font-medium text-social-navy hover:underline">
            {root.label}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span aria-current="page" className="font-semibold text-foreground">
            Departures and balances
          </span>
        </nav>
        <div>
          <h1 className="text-[22px] font-semibold leading-tight xl:text-2xl" data-testid="text-departures-title">
            Departures and balances
          </h1>
          <p className="mt-1 text-[13px] text-social-muted xl:text-[14px]" data-testid="text-departures-subline">
            {subline}
          </p>
        </div>
      </div>

      <DeparturesTabs tab={tab} counts={rows ? tabCounts(rows) : null} onChange={(t) => navigate(tabPath(t))} />

      <div id="departures-panel" role="tabpanel" aria-labelledby={`departures-tab-${tab}`}>
        {isLoading && !rows ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="departures-loading">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading departures…
          </div>
        ) : isError || !rows ? (
          <Card className="mx-auto mt-6 max-w-md p-6 text-center" data-testid="departures-error">
            <AlertCircle className="mx-auto mb-2 h-6 w-6 text-status-failed-fg" aria-hidden />
            <h2 className="text-base font-semibold">Couldn't load departures</h2>
            <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : "Please try again in a moment."}</p>
          </Card>
        ) : tab === "tickets" ? (
          <TicketsList rows={rows} onCheck={onCheck} />
        ) : (
          <BalancesList rows={rows} onCheck={onCheck} />
        )}
      </div>
    </div>
  );
}
