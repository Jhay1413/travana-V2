import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  LogOut,
  Search,
  Settings2,
  Sparkles,
  User2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { AskAiDialog } from "@/components/shared/ask-ai-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsDropdown } from "@/features/notifications/components/notifications-dropdown";
import { HeaderCreateMenu } from "@/components/layout/header-create-menu";
import { BrandMark, MobileSidenav } from "./app-sidenav";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalSearch } from "@/features/search/api/use-search-queries";

export function AppHeader() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery("");
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(trimmed), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const {
    data: globalSearchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGlobalSearch(debouncedQuery);

  const clients = useMemo(
    () => globalSearchData?.pages.flatMap((p) => p.clients) ?? [],
    [globalSearchData],
  );
  const bookings = useMemo(
    () => globalSearchData?.pages.flatMap((p) => p.bookings ?? []) ?? [],
    [globalSearchData],
  );
  const hasResults = clients.length > 0 || bookings.length > 0;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: container, rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, clients.length]);

  const userName = user?.firstName || user?.name || "";
  const userAvatar = user?.image || user?.avatar || user?.profileImageUrl;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 bg-[#2E3D50] px-4">
      {/* Below xl the rail is hidden, so the header carries the hamburger + brand. */}
      <div className="flex items-center gap-3 xl:hidden">
        <MobileSidenav />
        <BrandMark />
      </div>

      {/* Global search */}
      <div className="relative hidden w-full max-w-[600px] md:block" ref={searchRef}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/70" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSearchResults(true);
          }}
          onFocus={() => query.trim() && setShowSearchResults(true)}
          placeholder="Search Travana"
          className="h-9 rounded-lg border-transparent bg-[#46586F] pl-10 text-sm text-white placeholder:text-white/70 focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-offset-0"
          data-testid="header-search"
        />

        {showSearchResults && query.trim() && hasResults && (
          <div
            ref={scrollContainerRef}
            className="absolute top-full left-0 right-0 z-[9999] mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/95"
          >
            {bookings.length > 0 && (
              <SearchGroup label="Bookings" count={bookings.length}>
                {bookings.map((b) => (
                  <SearchRow
                    key={b.id}
                    title={b.name}
                    subtitle={b.subtitle}
                    onClick={() => {
                      navigate(
                        b.clientId
                          ? `/clients/${b.clientId}/bookings/${b.id}`
                          : `/bookings/${b.id}`,
                      );
                      setShowSearchResults(false);
                      setQuery("");
                    }}
                    testId={`search-result-booking-${b.id}`}
                  />
                ))}
              </SearchGroup>
            )}

            {clients.length > 0 && (
              <SearchGroup label="Clients" count={clients.length}>
                {clients.map((c) => (
                  <SearchRow
                    key={c.id}
                    title={c.name}
                    subtitle={c.subtitle}
                    onClick={() => {
                      navigate(`/clients/${c.id}`);
                      setShowSearchResults(false);
                      setQuery("");
                    }}
                    testId={`search-result-${c.id}`}
                  />
                ))}
                <div ref={sentinelRef} className="h-px w-full" aria-hidden />
                {isFetchingNextPage && (
                  <div className="px-4 py-2 text-center text-xs text-black/50 dark:text-white/50">
                    Loading more…
                  </div>
                )}
              </SearchGroup>
            )}
          </div>
        )}

        {showSearchResults && query.trim() && debouncedQuery && globalSearchData?.pages?.length && !hasResults && (
          <div className="absolute top-full left-0 right-0 z-[9999] mt-2 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/95">
            <p className="text-center text-sm text-black/50 dark:text-white/50">
              No results found for "{query}"
            </p>
          </div>
        )}
      </div>

      {/* Round "+" create button, right next to the search box. */}
      <div className="shrink-0 pl-3">
        <HeaderCreateMenu />
      </div>
      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setShowAskAi(true)}
          className="flex items-center gap-2 text-sm font-medium text-white/90 transition-colors hover:text-white"
          data-testid="button-ask-luna"
          aria-label="Ask Luna"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask Luna</span>
        </button>

        <div className="h-6 w-px bg-white/20" aria-hidden />

        {user && <NotificationsDropdown userId={user.id} />}

        <div className="h-6 w-px bg-white/20" aria-hidden />

        {userName && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 text-white/90 transition-colors hover:text-white"
                data-testid="button-user-menu"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-medium text-white">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden text-sm font-medium sm:inline">{userName}</span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl z-[200]">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate("/my-profile")}
                data-testid="menu-item-profile"
              >
                <User2 className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-settings">
                <Settings2 className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={() => logout()}
                data-testid="menu-item-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AskAiDialog open={showAskAi} onOpenChange={setShowAskAi} />
    </header>
  );
}

function SearchGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/5 dark:border-white/5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground/60">({count})</span>
      </div>
      {children}
    </div>
  );
}

function SearchRow({
  title,
  subtitle,
  onClick,
  testId,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 dark:border-white/5 last:border-b-0 transition-colors"
      data-testid={testId}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-black/50 dark:text-white/50 truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
    </button>
  );
}
