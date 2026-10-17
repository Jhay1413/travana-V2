import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Users } from "lucide-react";
import { useSetPrimaryQuote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@/features/quote/types";

/** The "+N" pill next to a title; opens the list of quote variants with "Set as main". */
export function DealCardQuotes({ transaction: t, count }: { transaction: Transaction; count: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const setPrimaryQuote = useSetPrimaryQuote();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const variants = t.quote_variants || [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span className="relative inline-block align-middle" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-[3px] rounded-full bg-stage-quoted-bg px-[7px] py-px text-[11px] font-semibold text-stage-quoted-fg"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={`${count} duplicate quote${count > 1 ? "s" : ""}`}
        data-testid={`button-duplicate-quotes-${t.id}`}
      >
        <Users className="h-[11px] w-[11px]" strokeWidth={2.2} />+{count}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-social-border bg-popover p-1 shadow-lg">
          {variants.map((q) => {
            const isPrimary = q.isQuoteCopy === false;
            return (
              <div key={q.id} className="group/qv flex w-full items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    if (t.client_id) setLocation(`/clients/${t.client_id}?holiday=quote:${q.id}`);
                  }}
                >
                  <span className="truncate text-xs text-foreground/80">{q.title || "Untitled quote"}</span>
                  {isPrimary && (
                    <span className="ml-auto shrink-0 rounded-full bg-stage-quoted-bg px-1.5 py-0.5 text-[9px] font-semibold text-stage-quoted-fg">Primary</span>
                  )}
                </button>
                {!isPrimary && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground opacity-0 transition-colors hover:text-social-orange-text group-hover/qv:opacity-100"
                    title="Set as main"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setPrimaryQuote.mutate(q.id, {
                        onSuccess: () => toast({ title: "Primary quote updated" }),
                        onError: () => toast({ title: "Failed to set primary", variant: "destructive" }),
                      });
                    }}
                  >
                    Set as main
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}
