/** Upper bound on pages pulled automatically for one calendar query. */
export const MAX_AUTO_PAGES = 25;

export interface AutoFetchState {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  pagesLoaded: number;
}

/** Whether the calendar should pull another page on its own: not while fetching, after an error, or past the page cap. */
export function shouldAutoFetchNext(state: AutoFetchState, maxPages: number = MAX_AUTO_PAGES): boolean {
  return state.hasNextPage && !state.isFetchingNextPage && !state.isFetchNextPageError && state.pagesLoaded < maxPages;
}
