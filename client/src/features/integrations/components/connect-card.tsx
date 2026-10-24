import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { CARD } from "./classes";
import { channelLabel } from "../lib/channel-status";
import { ChannelIcon } from "./channel-icon";
import { LinkPanel, type ReadyLink } from "./link-panel";

const DESCRIPTIONS: Record<string, string> = {
  whatsapp: "Your business WhatsApp number, approved through Meta.",
  messenger: "Messages sent to your Facebook Page.",
  instagram: "DMs to your Instagram business account.",
  telegram: "A Telegram bot for your agency.",
};

interface ConnectCardProps {
  types: string[];
  pendingType: string | null;
  link: ReadyLink | null;
  onConnect: (type: string) => void;
  onDelegate: (type: string) => void;
  onClearLink: () => void;
}

/** One tile per connectable channel type, plus the "Link ready" panel. */
export function ConnectCard({ types, pendingType, link, onConnect, onDelegate, onClearLink }: ConnectCardProps) {
  return (
    <section className={CARD} aria-labelledby="int-connect-h" data-testid="integrations-connect-card">
      <div>
        <h2 className="text-[15px] font-semibold xl:text-base" id="int-connect-h">
          Connect a channel
        </h2>
        <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">Opens SendSeven's secure connect page in a new tab.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {types.map((type) => (
          <div key={type} className="flex min-w-0 flex-col gap-3 rounded-xl border border-social-border p-3.5">
            <div className="flex items-start gap-3">
              <ChannelIcon type={type} size="lg" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{channelLabel(type)}</div>
                <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">{DESCRIPTIONS[type] ?? "Connect this channel to your inbox."}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={PRIMARY_ACTION}
                disabled={pendingType !== null}
                aria-label={`Connect ${channelLabel(type)}`}
                onClick={() => onConnect(type)}
                data-testid={`button-connect-${type}`}
              >
                {pendingType === type && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Connect
              </Button>
              <Button
                type="button"
                variant="outline"
                className={OUTLINE_ACTION}
                aria-label={`Email ${channelLabel(type)} connect link to a colleague`}
                onClick={() => onDelegate(type)}
                data-testid={`button-delegate-${type}`}
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email link to a colleague
              </Button>
            </div>
          </div>
        ))}
      </div>
      {link && <LinkPanel link={link} onClose={onClearLink} />}
    </section>
  );
}
