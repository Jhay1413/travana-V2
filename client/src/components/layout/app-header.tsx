import { useState } from "react";
import { Link } from "wouter";
import { Bell, LogOut, Search, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadNotifications } from "@/hooks/queries";

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const { data: unread } = useUnreadNotifications(user?.id ?? "");
  const unreadCount = unread?.length ?? 0;
  const [search, setSearch] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger data-testid="sidebar-toggle" />

      <form
        className="relative ml-2 hidden flex-1 max-w-md md:block"
        onSubmit={(e) => e.preventDefault()}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients, quotes, bookings…"
          className="pl-9"
          data-testid="header-search"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="header-notifications"
          aria-label="Notifications"
        >
          <Link href="/?s=notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              data-testid="header-user-menu"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? user?.avatar ?? undefined} alt={user?.name ?? "User"} />
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-medium">{user?.name ?? "User"}</span>
              {user?.email && (
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-profile">
              <Link href="/?s=profile">
                <UserIcon className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()} data-testid="menu-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
