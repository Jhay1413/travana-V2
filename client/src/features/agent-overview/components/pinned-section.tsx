import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ClipboardList,
  Pin,
  PinOff,
  Sparkles,
  Star,
  StickyNote,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useRemoveFavorite } from "@/features/favorite/api/use-favorite-mutations";

export function PinnedSection() {
  const [, navigate] = useLocation();
  const { data: userFavorites } = useFavorites();
  const removeFavoriteMutation = useRemoveFavorite();

  return (
    <Card className="glass ringed grain rounded-3xl p-4" data-testid="card-pinned-section">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10">
            <Star className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-black/80 dark:text-white/80">Pinned</div>
            <div className="text-[10px] text-black/45 dark:text-white/45">
              {userFavorites && userFavorites.length > 0
                ? `${userFavorites.length} item${userFavorites.length !== 1 ? "s" : ""}`
                : "No items pinned yet"}
            </div>
          </div>
        </div>
      </div>
      {userFavorites && userFavorites.length > 0 ? (
        <div className="space-y-1.5">
          {userFavorites.map((fav: any) => {
            const icon =
              fav.itemType === "client" ? (
                <UserRound className="h-3.5 w-3.5" />
              ) : fav.itemType === "quote" ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : fav.itemType === "note" ? (
                <StickyNote className="h-3.5 w-3.5" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              );
            const noteQuoteId =
              fav.itemType === "note" && fav.subtitle?.startsWith("quoteId:")
                ? fav.subtitle.split("|")[0].replace("quoteId:", "")
                : null;
            const href =
              fav.itemType === "client"
                ? `/clients/${fav.itemId}`
                : fav.itemType === "quote"
                  ? `/clients/_/quotes/${fav.itemId}`
                  : fav.itemType === "enquiry"
                    ? `/enquiries/${fav.itemId}`
                    : fav.itemType === "booking"
                      ? `/clients/_/bookings/${fav.itemId}`
                      : noteQuoteId
                        ? `/clients/_/quotes/${noteQuoteId}`
                        : "#";
            let displaySubtitle =
              fav.itemType === "note" && fav.subtitle?.includes("|")
                ? fav.subtitle.split("|").slice(1).join("|")
                : fav.subtitle;
            const resolvedClientName =
              fav.itemType !== "client" ? fav.clientName ?? null : null;
            if (
              fav.itemType !== "client" &&
              resolvedClientName &&
              !displaySubtitle?.includes(resolvedClientName)
            ) {
              displaySubtitle =
                resolvedClientName + (displaySubtitle ? " · " + displaySubtitle : "");
            }
            return (
              <motion.div
                key={fav.id}
                className="group flex items-center gap-2.5 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid={`card-pinned-${fav.id}`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  onClick={() =>
                    navigate(fav.itemType === "client" ? `/clients/${fav.itemId}` : href)
                  }
                  data-testid={`link-pinned-${fav.id}`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold">{fav.label}</div>
                    {displaySubtitle && (
                      <div className="truncate text-[10px] text-black/50 dark:text-white/50">
                        {displaySubtitle}
                      </div>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/30 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100 dark:text-white/30 dark:hover:bg-white/10 dark:hover:text-white/60"
                  onClick={() => removeFavoriteMutation.mutate(fav.id)}
                  title="Unpin"
                  data-testid={`button-unpin-${fav.id}`}
                >
                  <PinOff className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-3 py-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <Pin className="mx-auto h-5 w-5 text-black/20 dark:text-white/20 mb-1.5" />
          <div className="text-[11px] text-black/40 dark:text-white/40">
            Pin clients, quotes, or enquiries for quick access. Use the pin icon on any
            client card.
          </div>
        </div>
      )}
    </Card>
  );
}
