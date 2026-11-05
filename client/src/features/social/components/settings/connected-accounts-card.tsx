import { AlertTriangle, CheckCircle2, Facebook, Instagram } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SocialAccount } from "../../api/social-settings.api";
import { useSocialAccounts } from "../../api/use-social-settings-queries";

const PERMISSIONS = ["Publish posts", "Read page details"];

function AccountIcon({ platform }: { platform: SocialAccount["platform"] }) {
  if (platform === "instagram") return <Instagram className="h-5 w-5" aria-hidden="true" />;
  return <Facebook className="h-5 w-5" aria-hidden="true" />;
}

function StatusBadge({ account }: { account: SocialAccount }) {
  if (account.selectable) {
    return (
      <Badge className="gap-1 bg-status-scheduled-bg text-status-scheduled-fg">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-status-failed-bg text-status-failed-fg">
      <AlertTriangle className="h-3 w-3" /> {account.unavailableReason ?? "Unavailable"}
    </Badge>
  );
}

export function ConnectedAccountsCard() {
  const { data, isLoading, isError } = useSocialAccounts();

  return (
    <Card className="border-social-border">
      <CardHeader>
        <CardTitle className="text-social-navy">Connected accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <p className="text-sm text-status-failed-fg">Couldn&apos;t load connected accounts. Try again in a moment.</p>
        ) : !data?.configured ? (
          <div className="flex items-center gap-2">
            <Badge className="gap-1 bg-status-failed-bg text-status-failed-fg">
              <AlertTriangle className="h-3 w-3" /> Not configured
            </Badge>
            <p className="text-xs text-status-failed-fg">Ask your platform admin to configure OnlySocials.</p>
          </div>
        ) : data.accounts.length === 0 ? (
          <p className="text-sm text-social-muted">No accounts are available to your agency yet. Ask your platform admin to add one.</p>
        ) : (
          <ul className="space-y-3" data-testid="connected-accounts-list">
            {data.accounts.map((account) => (
              <li key={account.id} className="flex items-start gap-3" data-testid={`connected-account-${account.id}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <AccountIcon platform={account.platform} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-social-navy">{account.name}</span>
                    <StatusBadge account={account} />
                  </div>
                  <p className="text-sm text-social-muted">
                    {account.platform === "instagram" ? "Instagram" : "Facebook Page"}
                    {account.username ? ` · @${account.username}` : ""}
                  </p>
                  {account.selectable && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {PERMISSIONS.map((p) => (
                        <span key={p} className="rounded-full border border-social-border px-2 py-0.5 text-xs text-social-muted">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
