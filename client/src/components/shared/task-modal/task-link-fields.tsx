import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEAL_GROUP_LABELS, DEAL_GROUP_ORDER, dealKey, liveDealOptions, useClientSearch, type NeonClient, type TaskDealOption } from "@/features/client";
import { useTransactions } from "@/features/transaction";
import { clientDisplayName, cn } from "@/lib/utils";
import { TASK_FIELD_CLASS, TaskFieldRow } from "./task-form-fields";

const NO_DEAL = "__none__";

interface TaskLinkFieldsProps {
  client: NeonClient | null;
  onClientChange: (client: NeonClient | null) => void;
  /** Selected deal, or null for "just the client". */
  deal: TaskDealOption | null;
  onDealChange: (deal: TaskDealOption | null) => void;
  testIdPrefix: string;
}

const nameOf = (c: NeonClient) => clientDisplayName(c) || "Client";

/**
 * Optional "Client" search and "Deal" select for task forms opened without a
 * known client (dashboard, top-bar and pipeline "+"). Picking a deal attaches
 * the task to it; picking only a client attaches it to the client.
 */
export function TaskLinkFields({ client, onClientChange, deal, onDealChange, testIdPrefix: p }: TaskLinkFieldsProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const search = useClientSearch(debounced, 6);
  const results = search.data?.clients ?? [];
  const transactions = useTransactions({ clientId: client?.id }, { enabled: !!client });
  const deals = client && transactions.data ? liveDealOptions(transactions.data) : [];
  const groups = DEAL_GROUP_ORDER.map((type) => ({ type, items: deals.filter((d) => d.type === type) })).filter((g) => g.items.length > 0);

  const pickClient = (c: NeonClient) => {
    onClientChange(c);
    onDealChange(null);
    setQuery("");
    setDebounced("");
  };
  const clearClient = () => {
    onClientChange(null);
    onDealChange(null);
  };

  return (
    <>
      <TaskFieldRow id={client ? `${p}-client-remove` : `${p}-client`} label="Client (optional)" wide>
        {client ? (
          <div
            className="flex h-11 items-center justify-between gap-2 rounded-[10px] border border-social-border bg-background px-3.5 text-[14px]"
            data-testid={`${p}-client-picked`}
          >
            <span className="min-w-0 truncate font-medium">{nameOf(client)}</span>
            <button
              type="button"
              id={`${p}-client-remove`}
              onClick={clearClient}
              aria-label={`Remove ${nameOf(client)}`}
              className="shrink-0 rounded-md p-1 text-social-muted hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-social-muted" aria-hidden />
              <Input
                id={`${p}-client`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // Enter must not submit the task from the search box.
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Search clients by name or number"
                autoComplete="off"
                className={cn(TASK_FIELD_CLASS, "pl-9")}
                data-testid={`${p}-client-search`}
              />
              {search.isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-social-muted" aria-hidden />}
            </div>
            {debounced && search.isError && <p className="text-[12px] text-status-failed-fg">Couldn't search clients. Try again.</p>}
            {debounced && search.isSuccess && (
              <ul className="max-h-44 overflow-y-auto rounded-[10px] border border-social-border bg-card" data-testid={`${p}-client-results`}>
                {results.length === 0 ? (
                  <li className="px-3.5 py-2.5 text-[13px] text-social-muted">No clients found</li>
                ) : (
                  results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickClient(c)}
                        className="flex w-full items-baseline justify-between gap-3 border-b border-social-border px-3.5 py-2 text-left last:border-b-0 hover:bg-muted"
                        data-testid={`${p}-client-option-${c.id}`}
                      >
                        <span className="min-w-0 truncate text-[13px] font-medium">{nameOf(c)}</span>
                        <span className="shrink-0 text-[12px] text-social-muted">{c.phoneNumber}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}
      </TaskFieldRow>

      {client && (
        <TaskFieldRow id={`${p}-deal`} label="Deal (optional)" wide>
          <Select
            value={deal ? dealKey(deal) : NO_DEAL}
            onValueChange={(v) => onDealChange(deals.find((d) => dealKey(d) === v) ?? null)}
            disabled={transactions.isLoading}
          >
            <SelectTrigger id={`${p}-deal`} className="h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none" data-testid={`${p}-deal`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[650]">
              <SelectItem value={NO_DEAL}>{transactions.isLoading ? "Loading deals…" : "No deal, just the client"}</SelectItem>
              {groups.map((g) => (
                <SelectGroup key={g.type}>
                  <SelectLabel className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">{DEAL_GROUP_LABELS[g.type]}</SelectLabel>
                  {g.items.map((d) => (
                    <SelectItem key={dealKey(d)} value={dealKey(d)} data-testid={`${p}-deal-option-${d.id}`}>
                      <span className="font-medium">{d.title}</span>
                      {d.detail && <span className="ml-2 text-[12px] text-social-muted">{d.detail}</span>}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {transactions.isError && <p className="text-[12px] text-status-failed-fg">Couldn't load this client's deals.</p>}
          {transactions.isSuccess && deals.length === 0 && (
            <p className="text-[12px] text-social-muted" data-testid={`${p}-no-deals`}>
              This client has no live enquiries, quotes or bookings.
            </p>
          )}
        </TaskFieldRow>
      )}
    </>
  );
}
