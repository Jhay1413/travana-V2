import { messagesRepository } from "./messages.repository";
import type { ListMessagesParams } from "./messages.types";

// Thin orchestration over the repository. SendSeven owns message state; we proxy.

export const messagesService = {
  list: (params: ListMessagesParams) => messagesRepository.list(params),
  getById: (id: string) => messagesRepository.getById(id),
  send: (body: Record<string, unknown>) => messagesRepository.send(body),
  createInternalNote: (body: Record<string, unknown>) => messagesRepository.createInternalNote(body),
  mentionUsers: () => messagesRepository.mentionUsers(),
  react: (id: string, body: unknown) => messagesRepository.react(id, body),
  removeReaction: (id: string, body: unknown) => messagesRepository.removeReaction(id, body),
  translate: (id: string, body: unknown) => messagesRepository.translate(id, body),
  downloadAttachment: (attachmentId: string) => messagesRepository.downloadAttachment(attachmentId),
};
