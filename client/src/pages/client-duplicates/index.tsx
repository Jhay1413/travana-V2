import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, CopyCheck, Phone, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useDuplicatePhoneGroups } from "@/hooks/queries";
import { DuplicatePhoneMergeDialog } from "@/features/client/components/modals/DuplicatePhoneMergeDialog";

export default function ClientDuplicatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<{ phoneKey: string; displayPhone: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data } = useDuplicatePhoneGroups({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
  });

  const groups = data?.groups ?? [];

  // Resolving the last group on a page leaves it empty after the refetch —
  // step back rather than showing a blank list.
  useEffect(() => {
    if (data && groups.length === 0 && page > 1) setPage((p) => Math.max(1, p - 1));
  }, [data, groups.length, page]);

  return (
    <div className="px-5 pb-8 pt-5">
      <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4">
        <div className="grid gap-4" data-testid="panel-client-duplicates">
          <div>
            <h1 className="text-base font-semibold">Duplicate phone numbers</h1>
            <p className="text-xs text-black/50 dark:text-white/50">
              Phone numbers held by more than one client. Open one to pick the client to keep and merge the
              rest into it.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone or email..."
                className="w-full rounded-xl border border-black/10 bg-black/5 py-2 pl-9 pr-3 text-sm text-black/90 placeholder:text-black/40 outline-none transition focus:border-blue-500/50 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:bg-white/5"
                data-testid="input-client-duplicates-search"
              />
            </div>
            <div
              className="shrink-0 text-xs text-black/50 dark:text-white/50"
              data-testid="text-client-duplicates-count"
            >
              {data?.total ?? 0} duplicate number{(data?.total ?? 0) === 1 ? "" : "s"}
            </div>
          </div>

          <div className="space-y-1.5">
            {groups.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
                data-testid="empty-client-duplicates"
              >
                <CopyCheck className="mx-auto mb-2 h-8 w-8 text-black/15 dark:text-white/15" />
                <p className="text-sm text-black/50 dark:text-white/50">
                  {debouncedSearch ? "No duplicates match your search" : "No duplicate phone numbers found"}
                </p>
              </div>
            ) : (
              groups.map((group, idx) => (
                <motion.button
                  key={group.phoneKey}
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid={`card-duplicate-group-${group.phoneKey}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                  onClick={() => setOpenGroup({ phoneKey: group.phoneKey, displayPhone: group.samplePhone })}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5">
                    <Phone className="h-4 w-4 text-black/50 dark:text-white/60" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-sm font-semibold"
                      data-testid={`text-duplicate-phone-${group.phoneKey}`}
                    >
                      {group.samplePhone}
                    </div>
                    <div className="truncate text-[11px] text-black/50 dark:text-white/50">
                      {group.clientNames}
                    </div>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                    data-testid={`badge-duplicate-count-${group.phoneKey}`}
                  >
                    {group.clientCount} clients
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                </motion.button>
              ))
            )}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                data-testid="button-client-duplicates-prev"
              >
                Previous
              </button>
              <span
                className="text-xs text-black/50 dark:text-white/50"
                data-testid="text-client-duplicates-page"
              >
                Page {page} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                data-testid="button-client-duplicates-next"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </Card>

      <DuplicatePhoneMergeDialog
        phoneKey={openGroup?.phoneKey ?? null}
        displayPhone={openGroup?.displayPhone}
        onOpenChange={(open) => {
          if (!open) setOpenGroup(null);
        }}
      />
    </div>
  );
}
