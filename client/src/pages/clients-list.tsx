import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useNeonClients } from "@/hooks/queries";

export default function ClientsListPage() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data: clientsListData } = useNeonClients({
    page,
    limit: 15,
    search: search.trim() || undefined,
  });

  return (
    <div className="px-5 pb-8 pt-5">
      <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4">
        <div className="grid gap-4" data-testid="panel-clients-list">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search clients..."
                className="w-full rounded-xl border border-black/10 bg-black/5 py-2 pl-9 pr-3 text-sm text-black/90 placeholder:text-black/40 outline-none transition focus:border-blue-500/50 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:bg-white/5"
                data-testid="input-clients-list-search"
              />
            </div>
            <div
              className="text-xs text-black/50 dark:text-white/50 shrink-0"
              data-testid="text-clients-list-count"
            >
              {clientsListData?.total ?? 0} clients
            </div>
          </div>

          <div className="space-y-1.5">
            {!clientsListData?.clients || clientsListData.clients.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
                data-testid="empty-clients-list"
              >
                <Users className="mx-auto h-8 w-8 text-black/15 dark:text-white/15 mb-2" />
                <p className="text-sm text-black/50 dark:text-white/50">
                  {search ? "No clients match your search" : "No clients found"}
                </p>
              </div>
            ) : (
              clientsListData.clients.map((client: any, idx: number) => {
                const fullName =
                  [
                    client.title && client.title !== "NULL" ? client.title : "",
                    client.firstName,
                    client.surename,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Unknown";
                return (
                  <motion.button
                    key={client.id}
                    type="button"
                    className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                    data-testid={`card-clients-list-${client.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-sm font-bold text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                      {(client.firstName?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-semibold"
                        data-testid={`text-clients-list-name-${client.id}`}
                      >
                        {fullName}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-black/50 dark:text-white/50">
                        {client.email && <span className="truncate">{client.email}</span>}
                        {client.email && client.phoneNumber && <span>·</span>}
                        {client.phoneNumber && <span className="shrink-0">{client.phoneNumber}</span>}
                      </div>
                    </div>
                    {client.badge && (
                      <span
                        className="shrink-0 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
                        data-testid={`badge-clients-list-${client.id}`}
                      >
                        {client.badge}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                  </motion.button>
                );
              })
            )}
          </div>

          {clientsListData && clientsListData.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                data-testid="button-clients-list-prev"
              >
                Previous
              </button>
              <span
                className="text-xs text-black/50 dark:text-white/50"
                data-testid="text-clients-list-page"
              >
                Page {page} of {clientsListData.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= clientsListData.totalPages}
                onClick={() => setPage((p) => Math.min(clientsListData.totalPages, p + 1))}
                className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                data-testid="button-clients-list-next"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
