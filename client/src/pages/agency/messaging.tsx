import { Loader2, RadioTower } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { useBotConfig, useConnectWebhook, useDisconnectWebhook } from "@/features/ai-assistant/api/use-bot-config";

// Org-level messaging infrastructure: the SendSeven webhook that makes the inbox
// live. Deliberately NOT on the Bot Settings page — this is a connection setting
// that matters whether or not the AI is switched on, and burying it under "AI
// Assistant" implied you had to run the bot to get real-time messages.

export default function AgencyMessagingPage() {
  const { can } = useRole();
  const { toast } = useToast();
  const { data, isLoading } = useBotConfig();
  const connectWebhook = useConnectWebhook();
  const disconnectWebhook = useDisconnectWebhook();

  // "branding" is this codebase's de-facto org-admin settings gate (branches and
  // data management use it too) — only Admin/PlatformAdmin hold admin on it.
  if (!can("admin", "branding")) return <OwnerOnlyGate />;

  const status = data?.autoReply;
  const busy = connectWebhook.isPending || disconnectWebhook.isPending;

  const toggle = (checked: boolean) => {
    const mutation = checked ? connectWebhook : disconnectWebhook;
    mutation.mutate(undefined, {
      onSuccess: () =>
        toast({
          title: checked ? "Real-time messaging on" : "Real-time messaging off",
          description: checked
            ? "New messages now arrive instantly."
            : "The inbox will only update when refreshed.",
        }),
      onError: (err) =>
        toast({
          title: checked ? "Couldn't turn on real-time messaging" : "Couldn't turn it off",
          description: (err as Error).message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start gap-3">
          <RadioTower className="mt-1 h-5 w-5 text-black/60 dark:text-white/60" />
          <div>
            <h2 className="text-lg font-semibold">Messaging</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              How your agency's inbox receives messages from WhatsApp, Facebook, Instagram, SMS and email.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-black/50 dark:text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !status?.provisioned ? (
          <p className="rounded-lg border border-dashed border-black/12 bg-black/[0.02] px-3 py-3 text-sm text-black/50 dark:border-white/12 dark:bg-white/[0.03] dark:text-white/50">
            This organisation's messaging workspace isn't set up yet. It's created automatically shortly
            after sign-up — if this persists, contact support.
          </p>
        ) : (
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-sm font-medium">Real-time messages</div>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Deliver new messages to the inbox the moment they arrive, with a notification for your
                team. With this off, staff only see new messages when they refresh.
              </p>
              <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                {status.webhookConnected
                  ? "Connected — messages arrive instantly."
                  : "Not connected — the inbox updates on refresh only."}
                {status.enabled && " AI auto-reply is on and depends on this staying connected."}
              </p>
            </div>
            <Switch
              checked={status.webhookConnected}
              disabled={busy}
              onCheckedChange={toggle}
              data-testid="switch-realtime-messaging"
            />
          </div>
        )}
      </div>
    </div>
  );
}
