import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTags } from "@/hooks/queries";
import { useUpdateQuoteTags } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

interface QuoteWithTags {
  tags: string[];
}

/**
 * Owns the inline tag editor on the quote page: the new-tag input, the
 * suggestions popover, refs for outside-click dismissal, and the add/remove
 * actions which patch the quote and refresh dependent queries.
 */
export function useQuoteTagEditor(quoteId: string, quote: QuoteWithTags | null) {
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
    if (!quote) return;
    console.log("🏷️ Removing tag:", tag);
    const updated = quote.tags.filter((t) => t !== tag);
    updateTagsMutation.mutate(
      { id: quoteId, tags: updated },
      {
        onSuccess: () => {
          console.log("🏷️ Tag removed successfully");
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
        },
        onError: (error) => {
          console.error("🏷️ Failed to remove tag:", error);
          toast({ title: "Failed to remove tag", variant: "destructive" });
        },
      },
    );
  }

  function addTag(text: string) {
    if (!quote) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const updated = [...quote.tags, trimmed];
    console.log("🏷️ Adding tag:", trimmed, "Updated tags:", updated);
    updateTagsMutation.mutate(
      { id: quoteId, tags: updated },
      {
        onSuccess: () => {
          console.log("🏷️ Tag added successfully");
          setNewTag("");
          setShowTagSuggestions(false);
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
          queryClient.invalidateQueries({ queryKey: ["tags"] });
        },
        onError: (error) => {
          console.error("🏷️ Failed to add tag:", error);
          toast({ title: "Failed to add tag", variant: "destructive" });
        },
      },
    );
  }

  function addTagFromSuggestion(tag: string) {
    if (!quote) return;
    console.log("🏷️ Adding tag from suggestion:", tag);
    const updated = [...quote.tags, tag];
    updateTagsMutation.mutate(
      { id: quoteId, tags: updated },
      {
        onSuccess: () => {
          console.log("🏷️ Tag added successfully from suggestion");
          setNewTag("");
          setShowTagSuggestions(false);
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
          queryClient.invalidateQueries({ queryKey: ["tags"] });
        },
        onError: (error) => {
          console.error("🏷️ Failed to add tag from suggestion:", error);
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
