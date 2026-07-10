import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, KeyRound, Plug, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useConversationIntegration,
  useSetConversationIntegration,
  useRemoveConversationIntegration,
  useTestConversationIntegration,
} from "../api/use-conversation-integration";

// Platform-admin card for configuring a single tenant's SendSeven workspace
// token. Rendered on the platform-admin organization page.
export function SendSevenIntegrationCard({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const { data: status, isLoading } = useConversationIntegration(orgId);
  const setToken = useSetConversationIntegration(orgId);
  const removeToken = useRemoveConversationIntegration(orgId);
  const testConn = useTestConversationIntegration(orgId);

  const [token, setToken_] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setToken_("");
    setBaseUrl("");
  }, [orgId]);

  const save = async () => {
    if (!token.trim()) return;
    try {
      await setToken.mutateAsync({ token: token.trim(), baseUrl: baseUrl.trim() || undefined });
      toast({ title: "SendSeven connected", description: "This organisation's inbox now uses its own workspace token." });
      setToken_("");
    } catch (err) {
      toast({ title: "Couldn't save token", description: (err as Error).message, variant: "destructive" });
    }
  };

  const disconnect = async () => {
    try {
      await removeToken.mutateAsync();
      toast({ title: "Disconnected", description: "SendSeven token removed for this organisation." });
    } catch (err) {
      toast({ title: "Couldn't disconnect", description: (err as Error).message, variant: "destructive" });
    }
  };

  const test = async () => {
    try {
      const res = await testConn.mutateAsync();
      toast({ title: res.ok ? "Connection OK" : "Connection failed", description: res.message, variant: res.ok ? undefined : "destructive" });
    } catch (err) {
      toast({ title: "Test failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const connected = status?.configured && status.source === "org";
  const managed = status?.source === "tenant";

  return (
    <Card className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/5 dark:bg-white/10">
          <Plug className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">SendSeven (Unified Inbox)</div>
          <div className="text-xs text-black/50 dark:text-white/50">This tenant's workspace token — encrypted at rest, never sent to the browser.</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-black/50 dark:text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            {connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  Connected · <span className="font-mono text-xs">{status?.tokenMasked ?? "••••"}</span>
                </span>
              </>
            ) : managed ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Connected via managed sub-account — the platform parent token handles this tenant automatically.</span>
              </>
            ) : status?.source === "env" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-amber-500" />
                <span>Using the platform fallback token (not tenant-specific).</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-black/30 dark:text-white/30" />
                <span>Not connected — this tenant sees sample data.</span>
              </>
            )}
          </div>

          {status?.tenantId && (
            <div className="-mt-1 flex items-center gap-1.5 text-[11px] text-black/45 dark:text-white/45">
              <span>
                Auto-provisioned SendSeven sub-account: <span className="font-mono">{status.tenantId}</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(status.tenantId as string);
                    toast({ title: "Sub-account id copied", description: "Reached automatically via the platform parent token (X-Tenant-ID)." });
                  } catch {
                    toast({ title: "Copy failed", description: "Copy the id manually.", variant: "destructive" });
                  }
                }}
                title="Copy tenant id"
                className="grid h-5 w-5 place-items-center rounded text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ss-token" className="text-xs">{connected ? "Replace API token" : "API token"}</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30 dark:text-white/30" />
                <Input
                  id="ss-token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken_(e.target.value)}
                  placeholder="Paste this tenant's SendSeven token"
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ss-base" className="text-xs">Base URL <span className="text-black/40 dark:text-white/40">(optional)</span></Label>
              <Input
                id="ss-base"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={status?.baseUrl ?? "https://api.sendseven.com/api/v1"}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              {connected && (
                <Button variant="ghost" size="sm" onClick={disconnect} disabled={removeToken.isPending} className="text-red-500 hover:text-red-600">
                  {removeToken.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Disconnect
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={test} disabled={testConn.isPending}>
                {testConn.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Test
              </Button>
              <Button size="sm" onClick={save} disabled={!token.trim() || setToken.isPending}>
                {setToken.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
