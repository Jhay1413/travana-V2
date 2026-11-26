import { createContext, useContext, useLayoutEffect } from "react";

/**
 * The shell draws the floating header over whatever is at the top of the page. A page with a hero is dark there;
 * a page without one (a loading, error or not-found state) would put white text on cream, so the shell adds a
 * navy band behind the header until a hero registers itself.
 */
export const PortalHeroContext = createContext<{ register: () => () => void } | null>(null);

/** Called by a hero: tells the shell the top of the page is already dark. */
export function useRegisterPortalHero(): void {
  const ctx = useContext(PortalHeroContext);
  useLayoutEffect(() => ctx?.register(), [ctx]);
}
