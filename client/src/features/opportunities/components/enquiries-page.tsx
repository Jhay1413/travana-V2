import { useLocation } from "wouter";
import { Phone } from "lucide-react";
import { useOpportunityEnquiries } from "@/hooks/queries";
import { FilterBar } from "./filter-bar";
import { Pagination } from "./pagination";
import { StatusBadge } from "./status-badge";
import { useOpportunities } from "./opportunities-context";
import { enquiryStatuses } from "./_data";
import { currency, formatDate } from "./helpers";

export function EnquiriesPage() {
  const { apiFilters } = useOpportunities();
  const query = useOpportunityEnquiries(apiFilters);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;

  const [, navigate] = useLocation();

  return (
    <>
      <FilterBar statusOptions={enquiryStatuses} total={total} loading={query.isLoading} />

      <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1.5fr_1fr_.8fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wider">
            <div>Client</div>
            <div>Title</div>
            <div>Status</div>
            <div>Travel Date</div>
            <div>Guests</div>
            <div>Budget</div>
            <div>Created</div>
          </div>
          {items.length > 0 ? (
            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.5fr_1fr_.8fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer items-center"
                  onClick={() => item.clientId && navigate(`/clients/${item.clientId}`)}
                  data-testid={`row-opportunity-enquiry-${item.id}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{item.clientName}</div>
                    {item.clientPhone && (
                      <div className="truncate text-[10px] text-black/40 dark:text-white/40 flex items-center gap-0.5">
                        <Phone className="h-2.5 w-2.5" />
                        {item.clientPhone}
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
                    {item.budget && item.budget > 0 ? currency.format(item.budget) : "—"}
                  </div>
                  <div className="text-[10px] text-black/40 dark:text-white/40 tabular-nums">
                    {formatDate(item.dateCreated)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-black/40 dark:text-white/40">
              No enquiries found.
            </div>
          )}
        </div>
      </div>

      <Pagination totalPages={totalPages} />
    </>
  );
}
