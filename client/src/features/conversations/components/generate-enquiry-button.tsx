import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/features/social";
import { useMessages } from "../api/use-messages";
import { useGenerateEnquiryFromConversation } from "../api/use-ai-enquiry";
import { useContactLink } from "../api/use-contact-link";
import { contactLinkMatch } from "./client-link-section";
import { CreateEnquiryDrawer, isBadGateway, lastInbound, type CreatedEnquiry } from "./inbox/enquiry";
import type { EnquiryIntent } from "../api/ai-enquiry.api";
import type { Conversation } from "../types";

// Composer button that reads the conversation with AI and opens the "Create
// enquiry from this chat" drawer pre-filled. Requires the contact to be linked
// to a client (which is auto-attached); when unlinked it nudges the agent to link first.
export function GenerateEnquiryButton({
  conversation,
  triggerRef,
  onAskClient,
  onCreated,
  onGeneratingChange,
}: {
  conversation: Conversation;
  /** Lets the owner start the same flow from elsewhere (e.g. the client pane). */
  triggerRef?: MutableRefObject<(() => void) | null>;
  /** Drafted question for the client; the owner puts it in the reply box. */
  onAskClient?: (text: string) => void;
  /** Called once the enquiry is saved. */
  onCreated?: (created: CreatedEnquiry) => void;
  /** Mirrors the AI drafting state so other triggers can show feedback. */
  onGeneratingChange?: (pending: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: messagesData } = useMessages(conversation.id);
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const client = link?.linkedClient ?? null;
  const generate = useGenerateEnquiryFromConversation();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<EnquiryIntent | null>(null);
  // Tracks the drawer's open state so a result arriving after close is ignored.
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    onGeneratingChange?.(generate.isPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generate.isPending]);

  const onGenerate = async () => {
    if (!client) {
      toast({
        title: "Link a client first",
        description: "Connect this contact to a client before generating an enquiry.",
        variant: "destructive",
      });
      return;
    }
    const transcript = (messagesData?.items ?? [])
      .filter((m) => m.text && m.text.trim())
      .map((m) => `${m.direction === "outbound" ? "Agent" : "Customer"}: ${m.text!.trim()}`)
      .join("\n");
    if (!transcript) {
      toast({ title: "Nothing to analyse", description: "This conversation has no text messages yet.", variant: "destructive" });
      return;
    }
    setIntent(null);
    openRef.current = true;
    setOpen(true);
    try {
      const result = await generate.mutateAsync(transcript);
      if (openRef.current) setIntent(result);
    } catch (err) {
      if (isBadGateway(err)) {
        // The AI is unavailable: keep the drawer open so the agent can fill it by hand.
        setIntent(null);
        return;
      }
      setOpen(false);
      toast({ title: "Couldn't draft enquiry", description: errorMessage(err, "Please try again."), variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!triggerRef) return;
    triggerRef.current = () => {
      if (!generate.isPending) void onGenerate();
    };
    return () => {
      triggerRef.current = null;
    };
  });

  return (
    <>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generate.isPending}
        title={client ? "Draft an enquiry from this conversation" : "Link this contact to a client first"}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-social-border bg-card px-3.5 text-[13px] font-semibold transition hover:bg-muted disabled:opacity-60",
          !client && "text-social-muted",
        )}
      >
        {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
        {generate.isPending ? "Drafting…" : "Generate enquiry"}
      </button>
      {client && (
        <CreateEnquiryDrawer
          open={open}
          onOpenChange={setOpen}
          conversation={conversation}
          client={client}
          intent={intent}
          generating={generate.isPending}
          quote={lastInbound(messagesData?.items ?? [])}
          onAskClient={(text) => onAskClient?.(text)}
          onCreated={(created) => onCreated?.(created)}
        />
      )}
    </>
  );
}
