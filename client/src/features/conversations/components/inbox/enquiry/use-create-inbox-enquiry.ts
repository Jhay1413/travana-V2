import { useLocation } from "wouter";
import { useCreateTask, useCreateTransaction } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/features/social";
import { useCreateInternalNote } from "../../../api/use-messages";
import { buildInboxEnquiryPayload } from "./lib/build-payload";
import { enquiryHref } from "./lib/read-created";
import { planSaveSteps, type SaveOptions } from "./lib/save-plan";
import { openEnquiryAction } from "./open-enquiry-action";

export interface CreatedEnquiry {
  enquiryId: string;
  transactionId: string;
  title: string;
  clientId: string;
}

/** Save flow: transaction + enquiry, then the optional follow-up task and chat note. */
export function useCreateInboxEnquiry(args: {
  conversationId: string;
  clientId: string;
  firstName: string;
  onCreated(created: CreatedEnquiry): void;
  /** The enquiry exists but its ids could not be read; the owner should close so it is not created twice. */
  onDone(): void;
}) {
  const { conversationId, clientId, firstName, onCreated, onDone } = args;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const createTransaction = useCreateTransaction();
  // The enquiry id only exists after the transaction is saved, so the task hook
  // is bound to no entity; it still refreshes the shared task lists.
  const createTask = useCreateTask("enquiry", "");
  const createNote = useCreateInternalNote(conversationId);

  const save = async (opts: SaveOptions): Promise<boolean> => {
    let response: unknown;
    try {
      response = await createTransaction.mutateAsync(
        buildInboxEnquiryPayload(opts.form, { clientId, userId: opts.assigneeId, leadSource: opts.form.leadSource }),
      );
    } catch (err) {
      toast({ title: "Couldn't create the enquiry", description: errorMessage(err, "Please try again."), variant: "destructive" });
      return false;
    }
    const plan = planSaveSteps(response, opts, { conversationId, firstName, now: new Date() });
    if (plan.kind === "unreadable") {
      toast({ title: "Enquiry saved", description: "It was created, but we could not open it. Find it on the client page." });
      onDone();
      return true;
    }

    const { created, title } = plan;
    const problems: string[] = [];
    if (plan.task) {
      try {
        await createTask.mutateAsync(plan.task);
      } catch {
        problems.push("the follow-up task");
      }
    }
    if (plan.note) {
      try {
        await createNote.mutateAsync(plan.note);
      } catch {
        problems.push("the chat note");
      }
    }

    const href = enquiryHref(clientId, created.enquiryId);
    toast({
      title: `Enquiry created for ${firstName}`,
      description: problems.length ? `We could not add ${problems.join(" or ")}.` : undefined,
      action: openEnquiryAction(() => navigate(href)),
    });
    onCreated({ enquiryId: created.enquiryId, transactionId: created.transactionId, title, clientId });
    return true;
  };

  return { save, isSaving: createTransaction.isPending || createTask.isPending || createNote.isPending };
}
