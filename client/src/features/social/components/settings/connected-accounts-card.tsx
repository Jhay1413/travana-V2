import { AlertTriangle, CheckCircle2, Lock, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocialChannel } from "../../api/use-social-settings-queries";

const PERMISSIONS = ["Publish posts", "Read page details"];

export function ConnectedAccountsCard() {
  const { data, isLoading } = useSocialChannel();
  const connected = !!data && data.workspaceConfigured && data.apiKeyConfigured;

  return (
    <Card className="border-social-border">
      <CardHeader>
        <CardTitle className="text-social-navy">Connected accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <ThumbsUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-social-navy">{data.label}</span>
                {connected ? (
                  <Badge className="gap-1 bg-status-scheduled-bg text-status-scheduled-fg">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                ) : (
                  <Badge className="gap-1 bg-status-failed-bg text-status-failed-fg">
                    <AlertTriangle className="h-3 w-3" /> Not configured
                  </Badge>
                )}
              </div>
              {!connected && (
                <p className="text-xs text-status-failed-fg">Ask your platform admin to configure OnlySocials.</p>
              )}
              <p className="text-sm text-social-muted">OnlySocials account #{data.accountId}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {PERMISSIONS.map((p) => (
                  <span key={p} className="rounded-full border border-social-border px-2 py-0.5 text-xs text-social-muted">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Posts go out through the account above. Connecting other channels is not available yet.</span>
        </div>
      </CardContent>
    </Card>
  );
}
