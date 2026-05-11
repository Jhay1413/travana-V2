import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency } from "@/components/quote/quote-types";
import { QuoteSummaryTimeline } from "@/components/quote/QuoteSummaryTimeline";

interface QuoteCostingsCardProps {
  quote: any;
  pageLabel: string;
}

export function QuoteCostingsCard({ quote, pageLabel }: QuoteCostingsCardProps) {
  return (
    <Card
      className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
      data-testid="card-quote-summary-right"
    >
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
          <TabsTrigger
            value="summary"
            className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white"
            data-testid="tab-quote-summary"
          >
            Quote Summary
          </TabsTrigger>
          <TabsTrigger
            value="costings"
            className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white"
            data-testid="tab-quote-costings"
          >
            {pageLabel} Costings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-0">
          <QuoteSummaryTimeline quote={quote} />
        </TabsContent>

        <TabsContent value="costings" className="mt-0">
          <div className="flex items-center justify-between" data-testid="row-quote-summary-header">
            <div>
              <div className="text-sm font-semibold" data-testid="text-quote-summary-title">
                {pageLabel} Costings
              </div>
              <div className="mt-1 text-xs text-black/55" data-testid="text-quote-summary-subtitle">
                Commission and charges.
              </div>
            </div>
            <FileText className="h-4 w-4 text-black/35" aria-hidden />
          </div>

          <div className="mt-3 grid gap-2" data-testid="list-quote-summary-lines">
            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-quote-summary-total-price"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-total-price-label">
                Total price
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-price-value">
                {currency.format(quote.commissions.price)}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-quote-summary-commission"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-commission-label">
                Comm
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-commission-value">
                {currency.format(quote.commissions.commissionValue)}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-quote-summary-discount"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-discount-label">
                Discount
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-discount-value">
                {currency.format(quote.commissions.discounts)}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-quote-summary-service-charge"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-service-charge-label">
                Service charge
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-service-charge-value">
                {currency.format(quote.commissions.serviceCharge)}
              </div>
            </div>

            <div className="my-1 h-px w-full bg-black/10" data-testid="separator-quote-summary" />

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2"
              data-testid="row-quote-summary-total-commission"
            >
              <div
                className="text-xs font-semibold text-black/70"
                data-testid="text-quote-summary-total-commission-label"
              >
                Total commission
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-commission-value">
                {currency.format(quote.commissions.totalCommission)}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
