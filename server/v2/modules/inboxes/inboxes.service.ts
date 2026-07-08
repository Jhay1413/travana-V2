import { inboxesRepository } from "./inboxes.repository";

export const inboxesService = {
  list: () => inboxesRepository.list(),
};
