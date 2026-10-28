import { useMemo, useState } from "react";
import type { SsChannel } from "@/features/conversations";
import { useChannels, useChannelTypes, useDeleteChannel } from "@/features/conversations";
import type { OrgRole } from "@/types/auth/auth.types";
import { useRoles } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { useChannelHealth, useChannelWorkspaceStatus } from "../api/use-channels-extra";
import { connectableTypes } from "../lib/channel-status";
import { connectedWhatsappChannels } from "../lib/whatsapp-channels";
import { useRefreshOnReturn } from "../state/use-refresh-on-return";
import { useConnectFlow } from "../state/use-connect-flow";
import { ChannelsSection } from "./channels-section";
import { CARD } from "./classes";
import { DelegateDialog } from "./delegate-dialog";
import { HealthBanner } from "./health-banner";
import { IntegrationsHead } from "./integrations-head";
import { WhatsappSection } from "./whatsapp-section";

const WRITE_ROLES: OrgRole[] = ["org_admin", "branch_manager", "platform_admin"];

/** /agency/integrations: connect, review and disconnect the org's messaging channels; manage WhatsApp templates. */
export function IntegrationsPage() {
  const { hasAnyRole } = useRoles();
  const { toast } = useToast();
  const status = useChannelWorkspaceStatus();
  const provisioned = status.data?.provisioned === true;
  const canWrite = hasAnyRole(WRITE_ROLES);
  useRefreshOnReturn();

  const channels = useChannels(provisioned);
  const types = useChannelTypes(provisioned);
  const health = useChannelHealth(provisioned);
  const removeChannel = useDeleteChannel();
  const flow = useConnectFlow();

  const [delegateType, setDelegateType] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const waChannels = useMemo(() => connectedWhatsappChannels(channels.data, health.data), [channels.data, health.data]);
  const connectable = useMemo(() => connectableTypes(types.data), [types.data]);

  const disconnect = async (channel: SsChannel) => {
    setRemovingId(channel.id);
    try {
      await removeChannel.mutateAsync(channel.id);
      toast({ title: "Channel disconnected" });
    } catch (err) {
      toast({ title: "Couldn't disconnect", description: (err as Error).message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="text-compact -m-4 flex min-h-full min-w-0 flex-col gap-6 bg-social-page p-4 md:-m-6 md:p-6" data-testid="integrations-page">
      <IntegrationsHead />
      {status.isLoading ? null : status.isError ? (
        <section className={CARD} data-testid="integrations-status-error">
          <p className="text-[13px] text-social-muted xl:text-[14px]">Couldn't check the messaging workspace. Refresh to try again.</p>
        </section>
      ) : !provisioned ? (
        <section className={CARD} data-testid="integrations-not-provisioned">
          <p className="text-[13px] text-social-muted xl:text-[14px]">
            This organisation's messaging workspace isn't set up yet. It's created automatically shortly after sign-up — if this persists,
            contact support.
          </p>
        </section>
      ) : (
        <>
          <HealthBanner health={health.data} channels={channels.data} canWrite={canWrite} />
          <ChannelsSection
            channels={channels.data}
            connectable={connectable}
            health={health.data}
            loading={channels.isLoading}
            canWrite={canWrite}
            pendingType={flow.pendingType}
            removingId={removingId}
            link={flow.link}
            onConnect={(t) => void flow.connect(t)}
            onDelegate={setDelegateType}
            onDisconnect={(c) => void disconnect(c)}
            onClearLink={flow.clearLink}
          />
          {waChannels.length > 0 && <WhatsappSection channels={waChannels} canWrite={canWrite} />}
          <DelegateDialog channelType={delegateType} onClose={() => setDelegateType(null)} />
        </>
      )}
    </div>
  );
}
