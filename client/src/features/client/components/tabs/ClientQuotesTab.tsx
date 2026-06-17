import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import type { Transaction } from "@/types/quote";
import { type QuoteWithJoins, type BookingWithJoins, type Client } from "../client-types";
import { QuoteRowCard } from "./QuoteRowCard";
import { useClientQuoteGroups } from "../hooks/use-client-quote-groups";

interface ClientQuotesTabProps {
  quotes: QuoteWithJoins[];
  bookings: BookingWithJoins[];
  transactions: Transaction[];
  clientId: string;
  navigate: (to: string) => void;
  onNewQuote: () => void;
  expandedCopyGroups: Record<string, boolean>;
  setExpandedCopyGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  client: Client | null;
  userFavorites: Favorite[] | undefined;
  toggleFavoriteMutation: {
    mutate: (args: { itemType: string; itemId: string; label: string; subtitle: string }) => void;
  };
}

export function ClientQuotesTab({
  quotes,
  bookings,
  transactions,
  clientId,
  navigate,
  onNewQuote,
  expandedCopyGroups,
  setExpandedCopyGroups,
  client,
  userFavorites,
  toggleFavoriteMutation,
}: ClientQuotesTabProps) {
  const groups = useClientQuoteGroups(quotes, bookings, transactions, expandedCopyGroups);

  return (
    <div className="grid gap-3" data-testid="layout-quotes">
      <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quotes-list">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" data-testid="text-quotes-title">
              Quotes
            </div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-quotes-subtitle">
              Quick view of recent quotes for this client.
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
            data-testid="button-quotes-new"
            onClick={onNewQuote}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            New quote
          </Button>
        </div>

        <div className="mt-4 space-y-2" data-testid="section-quotes-groups">
          {groups.map((group) => (
            <div
              key={group.id}
              className={`rounded-3xl border p-2 ${
                group.id === "lost" ? "border-rose-500/20 bg-rose-500/[0.04]" : "border-black/10 bg-white/60"
              }`}
              data-testid={`group-quotes-${group.id}`}
            >
              <div
                className="flex items-center justify-between gap-3 px-2 py-2"
                data-testid={`row-quotes-group-header-${group.id}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="text-xs font-semibold text-black/80"
                    data-testid={`text-quotes-group-title-${group.id}`}
                  >
                    {group.title}
                  </div>
                  <span
                    className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/60"
                    data-testid={`pill-quotes-group-count-${group.id}`}
                  >
                    {group.count}
                  </span>
                </div>
              </div>

              <div className="grid gap-2" data-testid={`list-quotes-${group.id}`}>
                {group.items.map((item) => {
                  if (item.type === "toggle") {
                    const isExpanded = Boolean(expandedCopyGroups[item.parentId]);
                    const noun =
                      item.count === 1
                        ? item.label
                        : item.label === "quote"
                          ? "quotes"
                          : "copies";
                    return (
                      <button
                        key={`toggle-${item.parentId}`}
                        type="button"
                        className="ml-6 inline-flex w-fit items-center gap-1 rounded-xl border border-black/10 bg-white/70 px-2 py-1 text-[11px] font-semibold text-black/65 transition hover:bg-black/[0.03]"
                        data-testid={`button-toggle-copy-quotes-${item.parentId}`}
                        onClick={() =>
                          setExpandedCopyGroups((prev) => ({
                            ...prev,
                            [item.parentId]: !prev[item.parentId],
                          }))
                        }
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Hide" : "Show"} {item.count} {noun}
                      </button>
                    );
                  }

                  return (
                    <QuoteRowCard
                      key={item.row.id}
                      row={item.row}
                      isChild={item.isChild}
                      clientId={clientId}
                      navigate={navigate}
                      client={client}
                      userFavorites={userFavorites}
                      toggleFavoriteMutation={toggleFavoriteMutation}
                    />
                  );
                })}

                {group.items.length === 0 && (
                  <div
                    className="rounded-3xl border border-black/10 bg-white/70 p-4"
                    data-testid={`empty-quotes-${group.id}`}
                  >
                    <div className="text-sm font-semibold" data-testid={`text-empty-quotes-title-${group.id}`}>
                      No quotes
                    </div>
                    <div
                      className="mt-1 text-xs text-black/55"
                      data-testid={`text-empty-quotes-subtitle-${group.id}`}
                    >
                      Nothing in {group.title.toLowerCase()} yet.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
