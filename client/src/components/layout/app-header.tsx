import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  LogOut,
  Search,
  Settings2,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { HeaderCreateMenu } from "@/components/header-create-menu";
import { MobileSidenav } from "./app-sidenav";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalSearch } from "@/hooks/queries/use-search-queries";

export function AppHeader() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
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
  const hasResults = clients.length > 0;

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
    <div className="glass ringed grain rounded-3xl p-4 md:p-5 relative z-40">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <MobileSidenav />
          <h1
            className="title-serif text-2xl font-semibold tracking-tight md:text-3xl"
            data-testid="text-page-title"
          >
            Travana
          </h1>

          <div
            className="relative hidden md:block w-[280px] lg:w-[320px] z-[9999]"
            ref={searchRef}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50 z-10" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => query.trim() && setShowSearchResults(true)}
              placeholder="Search clients, quotes, bookings…"
              className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
              data-testid="header-search"
            />

            {showSearchResults && query.trim() && hasResults && (
              <div
                ref={scrollContainerRef}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] max-h-[420px] overflow-y-auto"
              >
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
              </div>
            )}

            {showSearchResults && query.trim() && debouncedQuery && globalSearchData?.pages?.length && !hasResults && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] p-4">
                <p className="text-center text-sm text-black/50 dark:text-white/50">
                  No results found for "{query}"
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HeaderCreateMenu />

          {user && <NotificationsDropdown userId={user.id} />}

          {userName && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 text-black/70 transition hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                  data-testid="button-user-menu"
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="" className="h-6 w-6 rounded-full" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm font-medium">{userName}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl z-[200]">
                <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-profile">
                  <User2 className="mr-2 h-4 w-4" />
                  Profile
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
      </div>
    </div>
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
