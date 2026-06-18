import { useLocation } from "wouter";
import { useOpportunityBookings } from "@/hooks/queries";
import { FilterBar } from "./filter-bar";
import { Pagination } from "./pagination";
import { StatusBadge } from "./status-badge";
import { useOpportunities } from "./opportunities-context";
import { bookingStatuses } from "./_data";
import { currency, formatDate } from "./helpers";

export function BookingsPage() {
  const { apiFilters } = useOpportunities();
  const query = useOpportunityBookings(apiFilters);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;

  const [, navigate] = useLocation();

  return (
    <>
      <FilterBar statusOptions={bookingStatuses} total={total} loading={query.isLoading} />

      <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[1.2fr_1fr_.7fr_.6fr_.6fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wider">
            <div>Client</div>
            <div>Title</div>
            <div>Status</div>
            <div>Travel Date</div>
            <div>Guests</div>
            <div>Price</div>
            <div>Commission</div>
            <div>Refs</div>
            <div>Created</div>
          </div>
          {items.length > 0 ? (
            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.2fr_1fr_.7fr_.6fr_.6fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer items-center"
                  onClick={() => item.clientId && navigate(`/clients/${item.clientId}`)}
                  data-testid={`row-opportunity-booking-${item.id}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{item.clientName}</div>
                    {item.agentName && (
                      <div className="truncate text-[10px] text-black/40 dark:text-white/40">
                        {item.agentName}
                      </div>
                    )}
                  </div>
                  <div className="truncate text-xs">{item.title}</div>
                  <div><StatusBadge status={item.status} /></div>
                  <div className="text-xs tabular-nums">{formatDate(item.travelDate)}</div>
                  <div className="text-xs tabular-nums">
                    {item.adults}A {item.children > 0 ? `${item.children}C` : ""}
                  </div>
                  <div className="text-xs tabular-nums font-medium">
                    {item.totalPrice && item.totalPrice > 0 ? currency.format(item.totalPrice) : "—"}
                  </div>
                  <div className="text-xs tabular-nums text-emerald-600">
                    {item.commission && item.commission > 0 ? currency.format(item.commission) : "—"}
                  </div>
                  <div className="min-w-0">
                    {item.haysRef && <div className="truncate text-[10px]">{item.haysRef}</div>}
                    {item.supplierRef && (
                      <div className="truncate text-[10px] text-black/40 dark:text-white/40">
                        {item.supplierRef}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-black/40 dark:text-white/40 tabular-nums">
                    {formatDate(item.dateCreated)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-black/40 dark:text-white/40">
              No bookings found.
            </div>
          )}
        </div>
      </div>

      <Pagination totalPages={totalPages} />
    </>
  );
}
