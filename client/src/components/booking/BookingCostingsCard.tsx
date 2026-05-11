import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency } from "@/components/quote/quote-types";
import { QuoteSummaryTimeline } from "@/components/quote/QuoteSummaryTimeline";

const currencyPence = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface BookingCostingsCardProps {
  booking: any;
  hasReferral: boolean;
}

export function BookingCostingsCard({ booking, hasReferral }: BookingCostingsCardProps) {
  return (
    <Card
      className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
      data-testid="card-booking-summary-right"
    >
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
          <TabsTrigger
            value="summary"
            className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white"
            data-testid="tab-booking-summary"
          >
            Booking Summary
          </TabsTrigger>
          <TabsTrigger
            value="costings"
            className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white"
            data-testid="tab-booking-costings"
          >
            Booking Costings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-0">
          <QuoteSummaryTimeline quote={booking} />
        </TabsContent>

        <TabsContent value="costings" className="mt-0">
          <div className="flex items-center justify-between" data-testid="row-booking-summary-header">
            <div>
              <div className="text-sm font-semibold" data-testid="text-booking-summary-title">
                Booking Costings
              </div>
              <div className="mt-1 text-xs text-black/55" data-testid="text-booking-summary-subtitle">
                Commission and charges.
              </div>
            </div>
            <FileText className="h-4 w-4 text-black/35" aria-hidden />
          </div>

          <div className="mt-3 grid gap-2" data-testid="list-booking-summary-lines">
            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-booking-summary-total-price"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-total-price-label">
                Total price
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-total-price-value">
                {currency.format(booking.commissions.price)}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-booking-summary-commission"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-commission-label">
                Comm
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-commission-value">
                {currency.format(booking.commissions.commissionValue)}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-booking-summary-discount"
            >
              <div className="text-xs font-semibold text-black/65" data-testid="text-booking-summary-discount-label">
                Discount
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-discount-value">
                {currency.format(booking.commissions.discounts)}
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
              data-testid="row-booking-summary-service-charge"
            >
              <div
                className="text-xs font-semibold text-black/65"
                data-testid="text-booking-summary-service-charge-label"
              >
                Service charge
              </div>
              <div
                className="text-xs font-semibold text-black"
                data-testid="text-booking-summary-service-charge-value"
              >
                {currency.format(booking.commissions.serviceCharge)}
              </div>
            </div>

            {booking.commissions.walletCredit > 0 && (
              <div
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2"
                data-testid="row-booking-summary-wallet-credit"
              >
                <div
                  className="text-xs font-semibold text-emerald-700"
                  data-testid="text-booking-summary-wallet-credit-label"
                >
                  Wallet credit applied
                </div>
                <div
                  className="text-xs font-semibold text-emerald-700"
                  data-testid="text-booking-summary-wallet-credit-value"
                >
                  -{currency.format(booking.commissions.walletCredit)}
                </div>
              </div>
            )}

            {hasReferral && (
              <>
                <div className="my-1 h-px w-full bg-black/10" data-testid="separator-booking-summary" />

                <div
                  className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2"
                  data-testid="row-booking-summary-referral-payout"
                >
                  <div
                    className="text-xs font-semibold text-amber-700"
                    data-testid="text-booking-summary-referral-payout-label"
                  >
                    Referral payout (25%)
                    <span className="ml-1 font-normal text-amber-500/70">est.</span>
                  </div>
                  <div
                    className="text-xs font-semibold text-amber-700"
                    data-testid="text-booking-summary-referral-payout-value"
                  >
                    {currencyPence.format(booking.commissions.referralPayout)}
                  </div>
                </div>
              </>
            )}
            <div
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2"
              data-testid="row-booking-summary-net-commission"
            >
              <div
                className="text-xs font-semibold text-black/70"
                data-testid="text-booking-summary-net-commission-label"
              >
                Net commission
              </div>
              <div className="text-xs font-semibold text-black" data-testid="text-booking-summary-net-commission-value">
                {currencyPence.format(booking.commissions.netCommission)}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
