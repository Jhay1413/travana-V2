import { useState } from "react";
import { Check, KeyRound, Loader2, ScanFace, Send, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPin } from "@/features/client/api/use-portal-pin";

/**
 * "Portal Access" card on the client overview: the PIN box with Send Link /
 * Change / Remove beside it, and a "PIN Active" badge once a PIN is set.
 */
export function PortalAccessCard({ clientId, className }: { clientId: string; className?: string }) {
  const { hasPin, loading, saving, sending, setPin, removePin, sendLink } = usePortalPin(clientId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const isEntering = editing || (!hasPin && !loading);

  const confirm = async () => {
    if (await setPin(draft)) {
      setEditing(false);
      setDraft("");
    }
  };

  return (
    <div
      className={cn("rounded-sm border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]", className)}
      data-testid="card-portal-pin"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanFace className="h-[22px] w-[22px] text-[#07a9f4]" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-black/90 dark:text-white">Portal Access</h3>
        </div>
        {hasPin && !editing && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-600" data-testid="badge-pin-active">
            <ShieldCheck className="h-4 w-4" /> PIN Active
          </span>
        )}
      </div>

      {/* Always one line: labels drop to icon-only on laptop widths rather than wrapping. */}
      <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap">
        <span className="shrink-0 text-xs font-semibold text-black/80 dark:text-white/80">PIN:</span>
        {loading ? (
          <span className="inline-flex h-7 items-center gap-2 text-xs text-black/40">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </span>
        ) : isEntering ? (
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={draft}
            autoFocus={editing}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirm();
              if (e.key === "Escape" && hasPin) {
                setEditing(false);
                setDraft("");
              }
            }}
            placeholder="4 digits"
            className="h-7 w-16 shrink-0 rounded-sm border border-black/10 bg-white text-center text-xs tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#07a9f4]/30 dark:border-white/10 dark:bg-white/[0.04]"
            data-testid="input-set-pin"
          />
        ) : (
          <span
            className="inline-flex h-7 w-16 shrink-0 items-center justify-center rounded-sm border border-black/10 bg-white text-xs tracking-[0.3em] text-black/60 dark:border-white/10 dark:bg-white/[0.04]"
            data-testid="portal-pin-masked"
          >
            ••••
          </span>
        )}

        {!loading && isEntering && (
          <>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={draft.length !== 4 || saving}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm bg-emerald-500 px-2 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
              data-testid="button-confirm-pin"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
              <span className="hidden xl:inline">{hasPin ? "Save" : "Set PIN"}</span>
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft("");
                }}
                className="inline-flex h-7 shrink-0 items-center rounded-sm bg-black/5 px-2 text-[11px] font-semibold text-black/60 transition hover:bg-black/10"
                data-testid="button-cancel-pin"
              >
                <X className="h-3.5 w-3.5 xl:hidden" strokeWidth={2.25} />
                <span className="hidden xl:inline">Cancel</span>
              </button>
            )}
          </>
        )}

        {!loading && hasPin && !editing && (
          <>
            <button
              type="button"
              onClick={sendLink}
              disabled={sending}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm bg-sky-200 px-2 text-[11px] font-semibold text-white transition hover:bg-sky-300 disabled:opacity-60"
              data-testid="button-send-portal-link"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.75} />}
              <span className="hidden xl:inline">Send Link</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm bg-emerald-200 px-2 text-[11px] font-semibold text-white transition hover:bg-emerald-300"
              data-testid="button-change-pin"
            >
              <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden xl:inline">Change</span>
            </button>
            <button
              type="button"
              onClick={() => void removePin()}
              disabled={saving}
              title="Remove PIN"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-pink-200 text-white transition hover:bg-pink-300 disabled:opacity-60"
              data-testid="button-remove-pin"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-3.5 w-3.5" strokeWidth={2.25} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
