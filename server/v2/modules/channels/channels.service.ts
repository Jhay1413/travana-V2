import { AppError } from "../../utils/error-handler";
import { channelsRepository } from "./channels.repository";
import { CONNECTABLE_TYPES } from "./channels.types";
import type { ConnectTokenCreate, DelegateConnectCreate } from "./channels.types";

// Lower-case and drop types SendSeven cannot connect; 400 if none remain.
function connectableTypes(input: string[]): string[] {
  const types = input.map((t) => t.toLowerCase()).filter((t) => CONNECTABLE_TYPES.has(t));
  if (types.length === 0) {
    throw new AppError(
      `Unsupported channel type(s). Connectable types: ${Array.from(CONNECTABLE_TYPES).join(", ")}`,
      400,
    );
  }
  return types;
}

export const channelsService = {
  listChannels: (forCompose?: boolean) => channelsRepository.listChannels(forCompose),
  channelTypes: () => channelsRepository.channelTypes(),
  workspaceStatus: async () => ({ provisioned: await channelsRepository.isConfigured() }),
  createConnectToken: async (body: ConnectTokenCreate) =>
    channelsRepository.createConnectToken({ ...body, allowed_channel_types: connectableTypes(body.allowed_channel_types) }),
  channelHealth: () => channelsRepository.channelHealth(),
  delegateConnect: async (body: DelegateConnectCreate) =>
    channelsRepository.delegateConnect({ ...body, channel_types: connectableTypes(body.channel_types) }),
  deleteChannel: (id: string) => channelsRepository.deleteChannel(id),
  whatsappStatus: (id: string) => channelsRepository.whatsappStatus(id),
};
