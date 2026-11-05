import { useEffect, useState } from "react";
import { Facebook, Instagram, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "../../lib/error-message";
import { useSetSocialAllowList } from "../../api/use-social-settings-mutations";
import { useSocialAllowList } from "../../api/use-social-settings-queries";
import { toggleAccount } from "../editor/platform-selection";

/**
 * Platform admin: which OnlySocials accounts one agency may post to. Lists every account in the
 * shared workspace. Leaving all unticked keeps the agency on the original single Facebook Page.
 */
export function OrgSocialAccountsCard({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useSocialAllowList(orgId);
  const save = useSetSocialAllowList(orgId);
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (data) setIds(data.allowedAccountIds);
  }, [data]);

  // Ids still stored for the agency that are no longer in the OnlySocials workspace: shown so they can be removed.
  const liveIds = new Set((data?.accounts ?? []).map((a) => a.id));
  const orphanIds = ids.concat((data?.allowedAccountIds ?? []).filter((id) => !ids.includes(id))).filter((id, i, all) => all.indexOf(id) === i && !liveIds.has(id));

  const dirty = !!data && [...ids].sort().join(",") !== [...data.allowedAccountIds].sort().join(",");

  const onSave = async () => {
    try {
      await save.mutateAsync(ids);
      toast({ title: "OnlySocials accounts saved" });
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err, "Try again."), variant: "destructive" });
    }
  };

  return (
    <div
      className="mt-4 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/5"
      data-testid="org-social-accounts-card"
    >
      <h3 className="text-sm font-semibold">OnlySocials accounts</h3>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Accounts this agency can post to from Social Posts. With none ticked the agency keeps the original Facebook Page only.
      </p>

      {isLoading ? (
        <Loader2 className="mt-4 h-4 w-4 animate-spin text-black/40" />
      ) : isError ? (
        <p className="mt-4 text-sm text-red-600">Couldn&apos;t load the OnlySocials accounts.</p>
      ) : !data?.configured ? (
        <p className="mt-4 text-sm text-black/60 dark:text-white/60">OnlySocials is not configured on the server.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.accounts.map((account) => (
            <li key={account.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                <input
                  type="checkbox"
                  checked={ids.includes(account.id)}
                  onChange={() => setIds((prev) => toggleAccount(prev, account.id))}
                  data-testid={`allow-account-${account.id}`}
                />
                {account.platform === "instagram" ? (
                  <Instagram className="h-4 w-4 text-pink-600" aria-hidden="true" />
                ) : (
                  <Facebook className="h-4 w-4 text-blue-600" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{account.name}</span>
                {!account.authorized && <span className="text-[11px] text-amber-700">Needs reconnecting</span>}
              </label>
            </li>
          ))}
          {orphanIds.map((id) => (
            <li key={`orphan-${id}`}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-amber-400 px-3 py-2 text-sm dark:border-amber-500/60">
                <input
                  type="checkbox"
                  checked={ids.includes(id)}
                  onChange={() => setIds((prev) => toggleAccount(prev, id))}
                  data-testid={`allow-account-orphan-${id}`}
                />
                <span className="min-w-0 flex-1 truncate text-amber-800 dark:text-amber-300">No longer in OnlySocials (#{id})</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" onClick={onSave} disabled={!dirty || save.isPending} data-testid="button-save-social-accounts">
          {save.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Save accounts
        </Button>
      </div>
    </div>
  );
}
