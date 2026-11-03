import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePinnedTicketIds } from "../../api/use-ticket-pin";
import { useNewTicketParams } from "../../state/use-new-ticket-params";
import { useTicketQueue } from "../../state/use-ticket-queue";
import { CreateTicketDialog } from "../dialogs/new-ticket/create-ticket-dialog";
import { TicketBoard } from "../board/ticket-board";
import { BulkBar } from "../list/bulk-bar";
import { TicketList } from "../list/ticket-list";
import { MobileQueue } from "./mobile-queue";
import { QueueHeader } from "./queue-header";
import { QueueToolbar } from "./queue-toolbar";

/** /tickets: the full-width queue, as a grouped list or a four-column board. */
export function TicketsQueue() {
  const [, navigate] = useLocation();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const mobile = useMediaQuery("(max-width: 900px)");
  const { prefs, patch, canViewAll, isLoading, result, now } = useTicketQueue({ boardAllowed: !mobile });
  const search = prefs.search;
  const setSearch = (value: string) => patch({ search: value });
  const pinned = usePinnedTicketIds();
  const { params, openNew, close } = useNewTicketParams();

  // Only rows still on screen can stay ticked.
  const visibleIds = useMemo(() => new Set(result.orderIds), [result.orderIds]);
  const pickedIds = [...picked].filter((id) => visibleIds.has(id));

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickAll = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const dialog = (
    <CreateTicketDialog
      open={params.open}
      onOpenChange={(open) => (open ? openNew() : close())}
      initialClientId={params.clientId}
      initialTransactionId={params.transactionId}
      initialStatus={params.status}
      onCreated={(ticket) => navigate(`/tickets/${ticket.id}`)}
    />
  );

  if (mobile) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] min-w-0 flex-col text-[14px] leading-[1.5]" data-testid="section-tickets">
        <MobileQueue
          result={result}
          counts={result.counts}
          chip={prefs.chip}
          onChipChange={(chip) => patch({ chip })}
          scope={prefs.scope}
          onScopeChange={(scope) => patch({ scope })}
          canViewAll={canViewAll}
          search={search}
          onSearchChange={setSearch}
          now={now}
          pinned={pinned}
          isLoading={isLoading}
          onNewTicket={() => openNew()}
        />
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] min-w-0 flex-col gap-3.5 text-[14px] leading-[1.5]" data-testid="section-tickets">
      <QueueHeader
        counts={result.counts}
        search={search}
        onSearchChange={setSearch}
        filters={prefs.filters}
        onFiltersChange={(filters) => patch({ filters })}
        sort={prefs.sort}
        onSortChange={(sort) => patch({ sort })}
        onNewTicket={() => openNew()}
      />
      <QueueToolbar
        view={prefs.view}
        onViewChange={(view) => patch({ view })}
        scope={prefs.scope}
        onScopeChange={(scope) => patch({ scope })}
        canViewAll={canViewAll}
        chip={prefs.chip}
        onChipChange={(chip) => patch({ chip })}
        counts={result.counts}
      />
      {prefs.view === "list" && pickedIds.length > 0 && <BulkBar ids={pickedIds} onClear={() => setPicked(new Set())} />}
      {prefs.view === "list" ? (
        <TicketList
          groups={result.groups}
          chip={prefs.chip}
          now={now}
          pills={result.pills}
          pinned={pinned}
          picked={new Set(pickedIds)}
          isLoading={isLoading}
          onPick={togglePick}
          onPickAll={pickAll}
        />
      ) : (
        <TicketBoard rows={result.rows} now={now} pills={result.pills} pinned={pinned} isLoading={isLoading} onAdd={(status) => openNew({ status })} />
      )}
      {dialog}
    </div>
  );
}
