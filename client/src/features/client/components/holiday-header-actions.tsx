import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Link as LinkIcon, Loader2, Pin, PinOff, Share2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useQuote, useBooking, useEnquiry, useUsers, quoteKeys, bookingKeys, enquiryKeys } from "@/hooks/queries";
import { useUpdateTransaction } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import type { User } from "@/features/user/types";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import { useQuoteImages, useQuotePin, useQuoteShare } from "@/features/quote/components/hooks";
import { useBookingPin } from "@/features/booking/components/hooks";
import { QuoteShareDialog } from "@/features/quote/components/QuoteShareDialog";
import {
  QuoteActionsMenu,
  BookingActionsMenu,
  EnquiryActionsMenu,
  HEADER_ICON_BUTTON_CLASS,
} from "@/features/client/components/holiday-detail-view";
import type { HolidaySelection } from "@/features/client/types";

// ─── Assigned agent avatar + reallocate popover ─────────────────────────────
// A round avatar with a "live" status dot; clicking it opens a searchable list
// of sales agents (same pattern as UserReassignSelect) to reassign the deal's
// owning transaction to someone else.

function AssignedAgentButton({
  transactionId,
  userId,
  onReallocated,
}: {
  transactionId: string;
  userId?: string | null;
  onReallocated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: users } = useUsers({ salesAgentsOnly: true });
  const updateTransactionMutation = useUpdateTransaction();

  const currentAgent = users?.find((u) => u.id === userId);
  const avatarUrl = currentAgent?.image ?? currentAgent?.profileImageUrl ?? currentAgent?.avatar ?? null;
  const initial = currentAgent?.name?.charAt(0).toUpperCase() ?? "?";

  function handleSelect(agent: User) {
    setOpen(false);
    if (agent.id === userId || updateTransactionMutation.isPending) return;
    updateTransactionMutation.mutate(
      { id: transactionId, data: { user_id: agent.id } },
      {
        onSuccess: () => {
          toast({ title: `Reallocated to ${agent.name}` });
          onReallocated();
        },
        onError: () => toast({ title: "Failed to reallocate", variant: "destructive" }),
      },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative h-[30px] w-[30px] shrink-0 rounded-full"
              aria-label="Reallocate deal"
              data-testid="client-header-agent"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-[30px] w-[30px] rounded-full object-cover" />
              ) : (
                <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#3b82f6]/10 text-xs font-bold text-[#3b82f6]">
                  {initial}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              {updateTransactionMutation.isPending && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70 dark:bg-black/50">
                  <Spinner className="h-4 w-4" />
                </span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Assigned to {currentAgent?.name ?? "Unassigned"} · click to reallocate
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search agents…" />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {users?.map((user) => (
                <CommandItem key={user.id} value={user.name} onSelect={() => handleSelect(user)}>
                  <Check className={cn("mr-2 h-4 w-4", user.id === userId ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Per-entity header actions ──────────────────────────────────────────────

interface HeaderActionsProps {
  id: string;
  clientId: string;
  clientName: string;
  onDeleted: () => void;
}

function HeaderActionsSkeleton() {
  return <div className="h-[30px] w-[30px] shrink-0 animate-pulse rounded-full bg-black/5 dark:bg-white/10" />;
}

function QuoteHeaderActions({ id, clientId, clientName, onDeleted }: HeaderActionsProps) {
  const queryClient = useQueryClient();
  const { data: quoteData, isLoading } = useQuote(id);
  const { quoteImageUrls } = useQuoteImages(quoteData);
  const quote = useMemo(() => (quoteData ? transformQuoteData(quoteData) : null), [quoteData]);

  const { isFavorited, togglePin } = useQuotePin(id, {
    label: quote?.quoteTitle ?? "",
    subtitle: `${clientName}${quote?.destinationName ? " · " + quote.destinationName : ""}`,
  });

  const {
    showSharePopup, setShowSharePopup,
    shareToken, shareCopied, shareLoading,
    openShare, copyShareLink,
  } = useQuoteShare(id);

  if (isLoading || !quoteData || !quote) return <HeaderActionsSkeleton />;

  return (
    <>
      <AssignedAgentButton
        transactionId={quote.transaction_id}
        userId={quoteData.user_id}
        onReallocated={() => queryClient.invalidateQueries({ queryKey: quoteKeys.all })}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={togglePin}
            className={cn(HEADER_ICON_BUTTON_CLASS, isFavorited && "border-amber-500/30 bg-amber-500/10 text-amber-700")}
            aria-label={isFavorited ? "Unpin" : "Pin"}
            data-testid="client-header-pin"
          >
            {isFavorited ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isFavorited ? "Unpin" : "Pin"}</TooltipContent>
      </Tooltip>
      {quoteData.quote_ref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={quoteData.quote_ref}
              target="_blank"
              rel="noopener noreferrer"
              className={HEADER_ICON_BUTTON_CLASS}
              aria-label="View Quote"
              data-testid="client-header-link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </a>
          </TooltipTrigger>
          <TooltipContent>View Quote</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openShare}
            className={HEADER_ICON_BUTTON_CLASS}
            aria-label="Share Quote"
            data-testid="client-header-share"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Share Quote</TooltipContent>
      </Tooltip>
      <QuoteActionsMenu
        quoteId={id}
        quoteData={quoteData}
        quote={quote}
        quoteImageUrls={quoteImageUrls}
        clientId={clientId}
        clientName={clientName}
        onDeleted={onDeleted}
        trigger="icon"
      />
      <QuoteShareDialog
        open={showSharePopup}
        onOpenChange={setShowSharePopup}
        shareToken={shareToken}
        shareCopied={shareCopied}
        shareLoading={shareLoading}
        onCopy={copyShareLink}
        clientId={clientId || undefined}
      />
    </>
  );
}

function BookingHeaderActions({ id, clientId, clientName, onDeleted }: HeaderActionsProps) {
  const queryClient = useQueryClient();
  const { data: bookingData, isLoading } = useBooking(id);
  const booking = useMemo(() => (bookingData ? transformQuoteData(bookingData) : null), [bookingData]);

  const { isFavorited, togglePin } = useBookingPin(id, {
    label: booking?.quoteTitle ?? "",
    subtitle: `${booking?.destinationName || booking?.destination || ""}`,
  });

  if (isLoading || !bookingData || !booking) return <HeaderActionsSkeleton />;

  return (
    <>
      <AssignedAgentButton
        transactionId={booking.transaction_id}
        userId={bookingData.user_id}
        onReallocated={() => queryClient.invalidateQueries({ queryKey: bookingKeys.all })}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={togglePin}
            className={cn(HEADER_ICON_BUTTON_CLASS, isFavorited && "border-amber-500/30 bg-amber-500/10 text-amber-700")}
            aria-label={isFavorited ? "Unpin" : "Pin"}
            data-testid="client-header-pin"
          >
            {isFavorited ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isFavorited ? "Unpin" : "Pin"}</TooltipContent>
      </Tooltip>
      <BookingActionsMenu bookingId={id} clientId={clientId} booking={booking} onDeleted={onDeleted} trigger="icon" />
    </>
  );
}

function EnquiryHeaderActions({ id, clientId, clientName, onDeleted }: HeaderActionsProps) {
  const queryClient = useQueryClient();
  const { data: enquiry, isLoading } = useEnquiry(id);
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const { toast } = useToast();

  const destinationName = enquiry?.destinations?.[0]?.name ?? null;
  const isEnquiryPinned = useMemo(
    () => userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === id) ?? false,
    [userFavorites, id],
  );

  function togglePin() {
    if (!enquiry) return;
    toggleFavoriteMutation.mutate(
      {
        itemType: "enquiry",
        itemId: id,
        label: enquiry.title || "Enquiry",
        subtitle: `${clientName || ""}${destinationName ? " · " + destinationName : ""}`,
      },
      {
        onSuccess: (data: { favorited?: boolean }) =>
          toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }),
      },
    );
  }

  if (isLoading || !enquiry) return <HeaderActionsSkeleton />;

  return (
    <>
      <AssignedAgentButton
        transactionId={enquiry.transaction_id}
        userId={enquiry.user_id}
        onReallocated={() => queryClient.invalidateQueries({ queryKey: enquiryKeys.all })}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={togglePin}
            className={cn(HEADER_ICON_BUTTON_CLASS, isEnquiryPinned && "border-amber-500/30 bg-amber-500/10 text-amber-700")}
            aria-label={isEnquiryPinned ? "Unpin" : "Pin"}
            data-testid="client-header-pin"
          >
            {isEnquiryPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isEnquiryPinned ? "Unpin" : "Pin"}</TooltipContent>
      </Tooltip>
      <EnquiryActionsMenu
        enquiryId={id}
        clientId={clientId}
        clientName={clientName}
        enquiry={enquiry}
        destinationName={destinationName}
        trigger="icon"
      />
    </>
  );
}

// ─── Entry point ────────────────────────────────────────────────────────────

export interface HolidayHeaderActionsProps {
  selection: HolidaySelection;
  clientId: string;
  clientName: string;
  onDeleted: () => void;
}

export function HolidayHeaderActions({ selection, clientId, clientName, onDeleted }: HolidayHeaderActionsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {selection.type === "quote" && (
          <QuoteHeaderActions id={selection.id} clientId={clientId} clientName={clientName} onDeleted={onDeleted} />
        )}
        {selection.type === "booking" && (
          <BookingHeaderActions id={selection.id} clientId={clientId} clientName={clientName} onDeleted={onDeleted} />
        )}
        {selection.type === "enquiry" && (
          <EnquiryHeaderActions id={selection.id} clientId={clientId} clientName={clientName} onDeleted={onDeleted} />
        )}
      </div>
    </TooltipProvider>
  );
}
