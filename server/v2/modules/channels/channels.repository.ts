import { AppError } from "../../utils/error-handler";
import { sendSevenRequest, useSampleData } from "../../utils/sendseven";
import type { ConnectTokenCreate, ConnectTokenResponse, SsChannel, SsChannelTypes } from "./channels.types";

// Repository: proxies channel operations to SendSeven using the CALLER'S OWN
// org token (resolved by the sendSevenContext middleware). Connecting a channel
// requires the org's SendSeven workspace to be provisioned first (by a platform
// admin), so the connect/disconnect ops error clearly when it isn't.

const SAMPLE_TYPES: SsChannelTypes = {
  available: ["whatsapp", "messenger", "instagram", "telegram"],
  coming_soon: ["gmail"],
  all_types: [
    { value: "whatsapp", display_name: "WhatsApp", is_available: true },
    { value: "messenger", display_name: "Messenger", is_available: true },
    { value: "instagram", display_name: "Instagram", is_available: true },
    { value: "telegram", display_name: "Telegram", is_available: true },
    { value: "gmail", display_name: "Gmail", is_available: false },
  ],
};

function notConnected(): AppError {
  return new AppError(
    "SendSeven isn't connected for this organisation yet. Ask your platform admin to add the workspace token first.",
    400,
  );
}

export const channelsRepository = {
  listChannels(forCompose?: boolean): Promise<SsChannel[]> {
    if (useSampleData()) return Promise.resolve([]);
    return sendSevenRequest("GET", "/channels", { query: { for_compose: forCompose } });
  },

  channelTypes(): Promise<SsChannelTypes> {
    if (useSampleData()) return Promise.resolve(SAMPLE_TYPES);
    return sendSevenRequest("GET", "/channels/types", {});
  },

  createConnectToken(body: ConnectTokenCreate): Promise<ConnectTokenResponse> {
    if (useSampleData()) return Promise.reject(notConnected());
    return sendSevenRequest("POST", "/channel-connect-tokens", { body });
  },

  deleteChannel(id: string): Promise<unknown> {
    if (useSampleData()) return Promise.reject(notConnected());
    return sendSevenRequest("DELETE", `/channels/${id}`, {});
  },

  whatsappStatus(id: string): Promise<unknown> {
    return sendSevenRequest("GET", `/whatsapp/channels/${id}/account-status`, {});
  },
};
