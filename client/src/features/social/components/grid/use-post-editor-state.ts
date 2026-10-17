import { useCallback, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { EnrichedQuote } from "@/features/quote/types";
import type { TravelDeal } from "@/features/social/api/social-post.api";
import { useGeneratePost } from "@/features/social/api/use-social-post-mutations";
import { useFetchTravelDeal } from "@/features/social/api/use-social-post-queries";
import { useSocialSettings } from "@/features/social/api/use-social-settings-queries";
import { DEFAULT_SOCIAL_SETTINGS } from "@/features/social/api/social-settings.api";
import { errorMessage } from "@/features/social/lib/error-message";
import { buildGenerateParams, getFirstImage } from "@/features/social/lib/quote-card-fields";
import { timezoneLabel } from "../schedule/timezone-label";
import type { SocialPostEditorDialogProps } from "../editor";

/**
 * Owns the editor dialog's state for the grid: which quote is open, its deal, and the
 * generate flow. Spread `editorProps` onto a single `SocialPostEditorDialog`.
 */
export function usePostEditorState() {
  const { toast } = useToast();
  const generatePost = useGeneratePost();
  const fetchTravelDeal = useFetchTravelDeal();
  // Bumped on every open/generate/regenerate and on close; a response whose token no longer matches is stale.
  const requestRef = useRef(0);
  const { data: settings } = useSocialSettings();
  const resolved = settings ?? DEFAULT_SOCIAL_SETTINGS;

  const [previewQuote, setPreviewQuote] = useState<EnrichedQuote | null>(null);
  const [previewDeal, setPreviewDeal] = useState<TravelDeal | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const close = useCallback(() => {
    requestRef.current += 1;
    setPreviewQuote(null);
    setPreviewDeal(null);
    setIsGenerating(false);
  }, []);

  const runGenerate = useCallback(
    async (quote: EnrichedQuote): Promise<TravelDeal | null> => {
      const params = buildGenerateParams(quote);
      if ("error" in params) {
        toast({ title: params.error, variant: "destructive" });
        return null;
      }
      try {
        return await generatePost.mutateAsync(params);
      } catch (err) {
        toast({ title: errorMessage(err, "Failed to generate post"), variant: "destructive" });
        return null;
      }
    },
    [generatePost, toast],
  );

  /** Opens the editor on a quote that has no post yet and fills it with Luna's draft. */
  const generate = useCallback(
    async (quote: EnrichedQuote): Promise<void> => {
      if ("error" in buildGenerateParams(quote)) {
        await runGenerate(quote);
        return;
      }
      const token = ++requestRef.current;
      setPreviewQuote(quote);
      setPreviewDeal(null);
      setIsGenerating(true);
      const deal = await runGenerate(quote);
      if (requestRef.current !== token) return;
      setIsGenerating(false);
      if (deal) setPreviewDeal(deal);
      else setPreviewQuote(null);
    },
    [runGenerate],
  );

  /** Opens the editor on a quote's existing post. */
  const openEditor = useCallback(
    async (quote: EnrichedQuote): Promise<void> => {
      const token = ++requestRef.current;
      setPreviewQuote(quote);
      setPreviewDeal(null);
      setIsGenerating(false);
      try {
        const deal = await fetchTravelDeal(quote.id);
        if (requestRef.current !== token) return;
        if (deal) setPreviewDeal(deal);
      } catch (err) {
        if (requestRef.current !== token) return;
        toast({ title: "Could not load the post", description: errorMessage(err, "Try again."), variant: "destructive" });
        setPreviewQuote(null);
      }
    },
    [toast, fetchTravelDeal],
  );

  const onRegenerate = useCallback(async (): Promise<void> => {
    if (!previewQuote) return;
    const token = ++requestRef.current;
    const deal = await runGenerate(previewQuote);
    if (requestRef.current !== token) return;
    if (deal) setPreviewDeal(deal);
  }, [previewQuote, runGenerate]);

  const editorProps = useMemo<SocialPostEditorDialogProps>(
    () => ({
      open: !!previewQuote,
      onOpenChange: (open: boolean) => {
        if (!open) close();
      },
      travelDeal: previewDeal,
      quoteImageUrl: previewQuote ? getFirstImage(previewQuote) : null,
      isGenerating,
      quoteId: previewQuote?.id ?? null,
      timeShortcuts: resolved.timeShortcuts,
      timezoneLabel: timezoneLabel(resolved.timezone),
      initialViewLink: resolved.defaultViewLink,
      initialPriceBadge: resolved.defaultPriceBadge,
      onRegenerate,
    }),
    [previewQuote, previewDeal, isGenerating, resolved, close, onRegenerate],
  );

  return {
    editorProps,
    generate,
    openEditor,
    /** Id of the quote currently being generated, for per-card spinners. */
    generatingQuoteId: isGenerating ? (previewQuote?.id ?? null) : null,
  };
}
