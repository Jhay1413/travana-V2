import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTags } from "@/hooks/queries";
import { useUpdateQuoteTags } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

interface BookingWithTags {
  tags: string[];
}

/**
 * Owns the inline tag editor on the booking page: input state, suggestions
 * popover, refs, outside-click dismissal, and add/remove actions which patch
 * the booking and invalidate the booking list cache.
 */
export function useBookingTagEditor(bookingId: string, booking: BookingWithTags | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);

  const { data: allTagsData } = useTags();
  const allTags = useMemo(() => allTagsData?.map((t) => t.name) || [], [allTagsData]);

  const updateTagsMutation = useUpdateQuoteTags();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        tagSuggestionsRef.current &&
        !tagSuggestionsRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function removeTag(tag: string) {
    if (!booking) return;
    const updated = booking.tags.filter((t) => t !== tag);
    updateTagsMutation.mutate(
      { id: bookingId, tags: updated },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
        },
        onError: () => {
          toast({ title: "Failed to remove tag", variant: "destructive" });
        },
      },
    );
  }

  function addTag(text: string) {
    if (!booking) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const updated = [...booking.tags, trimmed];
    updateTagsMutation.mutate(
      { id: bookingId, tags: updated },
      {
        onSuccess: () => {
          setNewTag("");
          setShowTagSuggestions(false);
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
          queryClient.invalidateQueries({ queryKey: ["tags"] });
        },
        onError: () => {
          toast({ title: "Failed to add tag", variant: "destructive" });
        },
      },
    );
  }

  function addTagFromSuggestion(tag: string) {
    if (!booking) return;
    const updated = [...booking.tags, tag];
    updateTagsMutation.mutate(
      { id: bookingId, tags: updated },
      {
        onSuccess: () => {
          setNewTag("");
          setShowTagSuggestions(false);
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
          queryClient.invalidateQueries({ queryKey: ["tags"] });
        },
        onError: () => {
          toast({ title: "Failed to add tag", variant: "destructive" });
        },
      },
    );
  }

  return {
    newTag,
    setNewTag,
    showTagSuggestions,
    setShowTagSuggestions,
    tagInputRef,
    tagSuggestionsRef,
    allTags,
    updateTagsMutation,
    removeTag,
    addTag,
    addTagFromSuggestion,
  };
}
