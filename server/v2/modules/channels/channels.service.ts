import { channelsRepository } from "./channels.repository";
import type { ConnectTokenCreate } from "./channels.types";

export const channelsService = {
  listChannels: (forCompose?: boolean) => channelsRepository.listChannels(forCompose),
  channelTypes: () => channelsRepository.channelTypes(),
  createConnectToken: (body: ConnectTokenCreate) => channelsRepository.createConnectToken(body),
  deleteChannel: (id: string) => channelsRepository.deleteChannel(id),
  whatsappStatus: (id: string) => channelsRepository.whatsappStatus(id),
};
