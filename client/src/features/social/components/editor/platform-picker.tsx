import { Facebook, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SocialAccount } from "../../api/social-settings.api";

interface PlatformPickerProps {
  accounts: SocialAccount[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  isLoading?: boolean;
  /** True when the account list could not be loaded (OnlySocials down). */
  loadError?: boolean;
  /** Retries the account list after a load error. */
  onRetry?: () => void;
  /** False when OnlySocials is not set up for the workspace. */
  configured?: boolean;
  /** Inline reason the current selection cannot be scheduled. */
  blockReason?: string | null;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function PlatformIcon({ platform }: { platform: SocialAccount["platform"] }) {
  if (platform === "instagram") return <Instagram className="h-3.5 w-3.5 text-pink-600" aria-hidden="true" />;
  return <Facebook className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />;
}

/** One toggle per connected account the agency may post to. */
export function PlatformPicker({ accounts, selectedIds, onToggle, isLoading, loadError, onRetry, configured = true, blockReason }: PlatformPickerProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="platform-picker">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Post to</p>

      {isLoading ? (
        <p className="text-xs text-slate-400">Loading connected accounts…</p>
      ) : loadError ? (
        <div className="flex items-center gap-3" data-testid="platform-load-error">
          <p className="text-xs text-red-600">Couldn't load connected accounts.</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="text-xs font-semibold text-slate-900 underline" data-testid="button-retry-accounts">
              Retry
            </button>
          )}
        </div>
      ) : !configured ? (
        <p className="text-xs text-slate-500">OnlySocials is not set up yet. Ask your platform admin to connect it.</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-slate-500">No accounts are available to your agency yet. Ask your platform admin to add one.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {accounts.map((account) => {
            const checked = selectedIds.includes(account.id);
            const disabled = !account.selectable;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={`${account.name} (${account.platform})`}
                  disabled={disabled}
                  onClick={() => onToggle(account.id)}
                  data-testid={`platform-account-${account.id}`}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                    checked ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    disabled && "cursor-not-allowed opacity-60 hover:bg-white",
                  )}
                >
                  {account.image ? (
                    <img src={account.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                      {initialsOf(account.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-slate-900">{account.name}</span>
                      <PlatformIcon platform={account.platform} />
                    </span>
                    {disabled && account.unavailableReason && (
                      <span className="block truncate text-[11px] text-amber-700" data-testid={`platform-reason-${account.id}`}>
                        {account.unavailableReason}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                      checked ? "border-amber-500 bg-amber-500 text-slate-900" : "border-slate-300 text-transparent",
                    )}
                  >
                    ✓
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {blockReason && (
        <p role="alert" className="text-xs font-medium text-amber-700" data-testid="platform-block-reason">
          {blockReason}
        </p>
      )}
    </div>
  );
}
