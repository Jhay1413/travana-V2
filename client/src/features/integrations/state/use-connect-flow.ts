import { useState } from "react";
import { useCreateConnectToken } from "@/features/conversations";
import { useToast } from "@/hooks/use-toast";
import type { ReadyLink } from "../components/link-panel";
import { connectRedirectUrl } from "../lib/channel-status";

/** Generates a connect link for one channel type, opens it in a new tab and keeps it for the "Link ready" panel. */
export function useConnectFlow() {
  const { toast } = useToast();
  const createToken = useCreateConnectToken();
  const [link, setLink] = useState<ReadyLink | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);

  const connect = async (channelType: string) => {
    // Open the tab synchronously in the click so Safari/Firefox don't treat it as a blocked popup.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setPendingType(channelType);
    try {
      const result = await createToken.mutateAsync({
        allowed_channel_types: [channelType],
        partner_redirect_url: connectRedirectUrl(window.location.origin, window.location.protocol),
      });
      setLink({ channelType, url: result.connect_url, expiresAt: result.expires_at });
      if (tab) tab.location.href = result.connect_url;
    } catch (err) {
      tab?.close();
      toast({ title: "Couldn't generate link", description: (err as Error).message, variant: "destructive" });
    } finally {
      setPendingType(null);
    }
  };

  return { connect, pendingType, link, clearLink: () => setLink(null) };
}
