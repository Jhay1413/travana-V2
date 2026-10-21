import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useQuote } from "@/hooks/queries";
import { useQuoteImages } from "@/features/quote/components/hooks";
import { transformQuoteData, type QuoteDisplay } from "@/features/quote/components/quote-types";
import { useClientQuoteViews, type ClientQuoteViewSummary } from "@/features/quote/api/use-quote-share-queries";
import { buildCompareColumn, cheapestIndex, type CompareColumn } from "@/features/client/lib/compare-rows";
import { gbp2 } from "@/features/client/lib/money-format";
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

export interface CompareCardProps {
  clientId: string;
  clientFirstName: string;
  /** The quote on screen: its display data and primary image. */
  current: QuoteDisplay;
  currentImageUrl: string | null;
  /** Ids of the other live quotes (at most two), newest first. */
  otherQuoteIds: string[];
}

function useOtherColumn(id: string, views: Map<string, ClientQuoteViewSummary>): CompareColumn | null {
  const { data } = useQuote(id);
  const { primaryImage } = useQuoteImages(data);
  return useMemo(() => {
    if (!data) return null;
    const summary = views.get(id);
    return buildCompareColumn(transformQuoteData(data), {
      imageUrl: primaryImage?.url || null,
      views: summary ? { viewCount: summary.viewCount, lastViewedAt: summary.lastViewedAt } : null,
      isCurrent: false,
    });
  }, [data, primaryImage?.url, views, id]);
}

interface RowDef {
  label: string;
  render: (c: CompareColumn, isCheapest: boolean) => ReactNode;
}

const ROWS: RowDef[] = [
  {
    label: "Price per person",
    render: (c, cheapest) => (
      <span className={cn(cheapest && "font-semibold text-qp-best")}>{c.pricePerPerson > 0 ? gbp2(c.pricePerPerson) : "Not set"}</span>
    ),
  },
  { label: "Total", render: (c) => gbp2(c.total) },
  { label: "Dates", render: (c) => c.dates },
  { label: "Board", render: (c) => c.board },
  { label: "Outbound", render: (c) => c.outbound },
];

/**
 * "Against {first name}'s other quotes": this quote beside up to two other live
 * quotes. Hidden when there are none. The cheapest price per person is green.
 */
export function CompareCard({ clientId, clientFirstName, current, currentImageUrl, otherQuoteIds }: CompareCardProps) {
  const { data: clientViews } = useClientQuoteViews(clientId);
  const views = useMemo(() => new Map((clientViews ?? []).map((v) => [v.quoteId, v])), [clientViews]);
  const first = useOtherColumn(otherQuoteIds[0] ?? "", views);
  const second = useOtherColumn(otherQuoteIds[1] ?? "", views);

  const currentColumn = useMemo(() => {
    const summary = views.get(current.id);
    return buildCompareColumn(current, {
      imageUrl: currentImageUrl,
      views: summary ? { viewCount: summary.viewCount, lastViewedAt: summary.lastViewedAt } : null,
      isCurrent: true,
    });
  }, [current, currentImageUrl, views]);

  if (otherQuoteIds.length === 0) return null;

  const columns = [currentColumn, first, second].filter((c): c is CompareColumn => c !== null);
  const cheapest = cheapestIndex(columns);
  const name = clientFirstName || "the client";
  const rows: RowDef[] = [...ROWS, { label: `${name}’s views`, render: (c) => c.views }];

  return (
    <section className={HOLIDAY_CARD} aria-labelledby="holiday-compare-h" data-testid="holiday-compare-card">
      <div className="mb-4">
        <h2 id="holiday-compare-h" className="text-base font-semibold leading-snug">
          Against {name}&rsquo;s other quotes
        </h2>
        <p className="mt-0.5 text-[13px] text-qp-muted">The cheapest price per person is in green.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-separate border-spacing-0 text-[13px]">
          <caption className="sr-only">This quote compared with {name}&rsquo;s other open quotes</caption>
          <thead>
            <tr>
              <td />
              {columns.map((c) => (
                <th key={c.id} scope="col" className={cn("px-3 pb-3 pt-2.5 text-left align-top font-normal", c.isCurrent && "rounded-t-[10px] bg-qp-current-tint")}>
                  <div className="flex flex-col gap-1.5">
                    <div className="h-[70px] overflow-hidden rounded-[10px] bg-muted">
                      {c.imageUrl && <img src={c.imageUrl} alt="" className="size-full object-cover" />}
                    </div>
                    {c.isCurrent ? (
                      <b className="font-semibold leading-snug">{c.title}</b>
                    ) : (
                      <Link href={`/clients/${clientId}?holiday=quote:${c.id}`} className="font-semibold leading-snug text-social-navy hover:underline">
                        {c.title}
                      </Link>
                    )}
                    <span className="text-qp-muted">
                      {c.place}
                      {c.isCurrent ? `${c.place ? " · " : ""}this quote` : ""}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r, all) => (
              <tr key={row.label}>
                <th scope="row" className="w-[130px] whitespace-nowrap border-b border-social-border px-3 py-2.5 text-left align-top font-medium text-qp-muted">
                  {row.label}
                </th>
                {columns.map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(
                      "border-b border-social-border px-3 py-2.5 align-top",
                      c.isCurrent && "bg-qp-current-tint",
                      c.isCurrent && r === all.length - 1 && "rounded-b-[10px]",
                    )}
                  >
                    {row.render(c, cheapest === i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
