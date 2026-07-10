import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCreateTransaction } from "@/hooks/mutations";
import { EnquiryWizard } from "@/features/enquiry/components/enquiry-wizard";
import { buildEnquiryTransaction } from "@/features/enquiry/lib/build-enquiry-transaction";
import type { EnquiryTable } from "@/features/quote/types";
import { useMessages } from "../api/use-messages";
import { useGenerateEnquiryFromConversation } from "../api/use-ai-enquiry";
import { useContactLink } from "../api/use-contact-link";
import { contactLinkMatch } from "./client-link-section";
import type { EnquiryIntent } from "../api/ai-enquiry.api";
import type { Conversation } from "../types";

// Composer button that drafts an enquiry from the conversation with AI and opens
// the enquiry wizard pre-filled. Requires the contact to be linked to a client
// (which is auto-attached); when unlinked it nudges the agent to link first.
export function GenerateEnquiryButton({ conversation }: { conversation: Conversation }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: messagesData } = useMessages(conversation.id);
  const { data: link } = useContactLink(conversation.contact.id, contactLinkMatch(conversation));
  const clientId = link?.linkedClient?.id ?? null;
  const generate = useGenerateEnquiryFromConversation();
  const createTransaction = useCreateTransaction();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [intent, setIntent] = useState<EnquiryIntent | null>(null);

  const onGenerate = async () => {
    if (!clientId) {
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
    try {
      const result = await generate.mutateAsync(transcript);
      setIntent(result);
      setWizardOpen(true);
    } catch (err) {
      toast({ title: "Couldn't draft enquiry", description: (err as Error).message, variant: "destructive" });
    }
  };

  const onSubmit = (data: Partial<EnquiryTable>) => {
    if (!clientId || !user?.id) return;
    createTransaction.mutate(
      buildEnquiryTransaction(data as Record<string, unknown>, { clientId, userId: user.id }),
      {
        onSuccess: () => {
          setWizardOpen(false);
          toast({ title: "Enquiry created", description: "Drafted from the conversation and saved to the client." });
        },
        onError: (err) =>
          toast({ title: "Failed to create enquiry", description: (err as Error).message, variant: "destructive" }),
      },
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generate.isPending}
        title={clientId ? "Draft an enquiry from this conversation" : "Link this contact to a client first"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60",
          clientId
            ? "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5"
            : "text-black/35 hover:bg-black/5 dark:text-white/35 dark:hover:bg-white/5",
        )}
      >
        {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {generate.isPending ? "Drafting…" : "Generate Enquiry"}
      </button>
      <EnquiryWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        enquiry={null}
        aiPrefill={intent}
        onSubmit={onSubmit}
        isSaving={createTransaction.isPending}
      />
    </>
  );
}
