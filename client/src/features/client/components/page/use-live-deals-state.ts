import { useRef, useState, type MutableRefObject } from "react";
import type { DealSort, PriceBand } from "@/features/client/lib/live-deal-rows";

export type LiveDealsTab = "enquiry" | "quotes" | "bookings";

export interface LiveDealsState {
  tab: LiveDealsTab;
  setTab: (tab: LiveDealsTab) => void;
  sort: DealSort;
  setSort: (sort: DealSort) => void;
  band: PriceBand;
  setBand: (band: PriceBand) => void;
  search: string;
  setSearch: (search: string) => void;
  searching: boolean;
  setSearching: (searching: boolean) => void;
  expiredOpen: boolean;
  setExpiredOpen: (open: boolean) => void;
  lostOpen: boolean;
  setLostOpen: (open: boolean) => void;
  /** True once the default stage was chosen or the user picked one; keeps the rail from re-choosing. */
  tabSettled: MutableRefObject<boolean>;
}

/**
 * Rail view state. The page owns it (not the rail) so tab, sort, price filter
 * and search survive opening a deal and coming back to the overview.
 */
export function useLiveDealsState(): LiveDealsState {
  const [tab, setTabState] = useState<LiveDealsTab>("quotes");
  const [sort, setSort] = useState<DealSort>("newest");
  const [band, setBand] = useState<PriceBand>("any");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [expiredOpen, setExpiredOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const tabSettled = useRef(false);

  const setTab = (next: LiveDealsTab) => {
    tabSettled.current = true;
    setTabState(next);
  };

  return {
    tab,
    setTab,
    sort,
    setSort,
    band,
    setBand,
    search,
    setSearch,
    searching,
    setSearching,
    expiredOpen,
    setExpiredOpen,
    lostOpen,
    setLostOpen,
    tabSettled,
  };
}
