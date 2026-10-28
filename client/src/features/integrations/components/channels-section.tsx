import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { SsChannel } from "@/features/conversations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { groupChannelsByType } from "../lib/channel-groups";
import type { ChannelHealth } from "../types";
import { ChannelCard } from "./channel-card";
import { SECTION_SUB, SECTION_TITLE } from "./classes";
import { LinkPanel, type ReadyLink } from "./link-panel";

interface ChannelsSectionProps {
  channels: SsChannel[] | undefined;
  /** Channel types the org may connect. */
  connectable: string[];
  health: ChannelHealth | undefined;
  loading: boolean;
  canWrite: boolean;
  pendingType: string | null;
  removingId: string | null;
  link: ReadyLink | null;
  onConnect: (type: string) => void;
  onDelegate: (type: string) => void;
  onDisconnect: (channel: SsChannel) => void;
  onClearLink: () => void;
}

/** "Channels": one card per channel type, the generated connect link, and the disconnect confirmation. */
export function ChannelsSection({
  channels,
  connectable,
  health,
  loading,
  canWrite,
  pendingType,
  removingId,
  link,
  onConnect,
  onDelegate,
  onDisconnect,
  onClearLink,
}: ChannelsSectionProps) {
  const [confirm, setConfirm] = useState<SsChannel | null>(null);
  const groups = useMemo(() => groupChannelsByType(connectable, channels), [connectable, channels]);
  const confirmName = confirm ? confirm.name || confirm.channel_type : "";

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="int-channels-h" data-testid="integrations-channels">
      <div>
        <h2 className={SECTION_TITLE} id="int-channels-h">
          Channels
        </h2>
        <p className={SECTION_SUB}>
          Accounts are authorised on SendSeven's secure connect page; Meta approves WhatsApp, Messenger and Instagram. Travana never stores your logins.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-social-border px-4 py-8 text-[13px] text-social-muted" data-testid="integrations-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading channels…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <ChannelCard
              key={group.type}
              group={group}
              health={health}
              canWrite={canWrite}
              pendingType={pendingType}
              removingId={removingId}
              onConnect={onConnect}
              onDelegate={onDelegate}
              onDisconnect={setConfirm}
            />
          ))}
        </div>
      )}

      {link && <LinkPanel link={link} onClose={onClearLink} />}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {confirmName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Messages from this account will stop arriving in the inbox. You can connect it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-disconnect"
              onClick={() => {
                if (confirm) onDisconnect(confirm);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
