import { useRoute } from "wouter";
import { SocialQuotePageView } from "@/features/social/components/quote-page/social-quote-page";

/** Route `/social-posts/quotes/:quoteId` (SOCIAL_ROLES): the free social quote, in the client quote page design. */
export default function SocialQuotePage() {
  const [, params] = useRoute("/social-posts/quotes/:quoteId");
  return <SocialQuotePageView quoteId={params?.quoteId ?? ""} />;
}
