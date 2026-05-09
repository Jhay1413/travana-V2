import { searchRepository } from './search.repository';

export const searchService = {
  async globalSearch(q: string, limit = 15) {
    return searchRepository.globalSearch(q, limit);
  },
};
