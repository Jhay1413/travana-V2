import { useLayoutEffect, useRef } from "react";

// Thread scroll container: opens at the newest message (bottom) instead of
// the top, and stays pinned to the bottom as new messages arrive while the
// user is already near it — without yanking them away if they've scrolled
// up to read history.
export function useThreadScroll(conversationId: string | null, messageCount: number) {
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastScrolledIdRef = useRef<string | null>(null);

  const handleThreadScroll = () => {
    const el = threadScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useLayoutEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    const firstLoadForConversation = lastScrolledIdRef.current !== conversationId;
    if (firstLoadForConversation || nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
    }
    if (firstLoadForConversation) lastScrolledIdRef.current = conversationId;
  }, [conversationId, messageCount]);

  return { threadScrollRef, handleThreadScroll };
}
