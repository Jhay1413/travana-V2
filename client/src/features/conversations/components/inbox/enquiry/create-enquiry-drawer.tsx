import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useUsers } from "@/hooks/queries";
import { useAuth } from "@/hooks/use-auth";
import { clientDisplayName } from "@/lib/utils";
import type { NeonClient } from "@/features/client";
import type { EnquiryIntent } from "../../../api/ai-enquiry.api";
import type { Conversation } from "../../../types";
import { ChannelAvatar } from "../shared";
import { EnquiryFields } from "./enquiry-fields";
import { askText, missingForClient } from "./lib/ask-text";
import { defaultAssigneeId } from "./lib/default-assignee";
import { validateEnquiryForm } from "./lib/enquiry-form";
import { firstNameFor } from "./lib/first-name";
import type { ResolvedIntent } from "./lib/resolve-intent";
import { ChatQuote, StillNeeded } from "./still-needed";
import { useCreateInboxEnquiry, type CreatedEnquiry } from "./use-create-inbox-enquiry";
import { useEnquiryForm } from "./use-enquiry-form";
import { useEnquiryPrefill } from "./use-enquiry-prefill";
import { WhenYouSave } from "./when-you-save";

export interface CreateEnquiryDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  conversation: Conversation;
  client: NeonClient;
  /** What the AI pulled from the chat; null when it found nothing or failed. */
  intent: EnquiryIntent | null;
  /** The client's last message, quoted in the drawer. */
  quote: { text: string; at: string } | null;
  /** Receives a drafted question for the reply box. */
  onAskClient(text: string): void;
  onCreated(created: CreatedEnquiry): void;
  /** True while Luna is reading the chat; the form mounts only once it is false. */
  generating?: boolean;
}

interface FormProps extends Omit<CreateEnquiryDrawerProps, "open" | "intent" | "generating"> {
  resolved: ResolvedIntent;
  /** Mirrors "a save is in flight" so the sheet can ignore dismissals meanwhile. */
  savingRef: MutableRefObject<boolean>;
}

function Header({ subtitle, onClose }: { subtitle: string; onClose(): void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-social-border px-7 pb-4 pt-[22px]">
      <div className="min-w-0">
        <SheetTitle className="text-[20px] font-semibold leading-tight">Create enquiry from this chat</SheetTitle>
        <SheetDescription className="mt-1 text-[12px] text-social-muted">{subtitle}</SheetDescription>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-social-muted hover:bg-black/5 dark:hover:bg-white/10">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function DrawerForm({ resolved, conversation, client, quote, onAskClient, onCreated, onOpenChange, savingRef }: FormProps) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const api = useEnquiryForm(resolved);
  const first = firstNameFor(client, conversation.contact);
  const [assigneeId, setAssigneeIdState] = useState("");
  const assigneeTouched = useRef(false);
  const setAssigneeId = (id: string) => {
    assigneeTouched.current = true;
    setAssigneeIdState(id);
  };
  // Default once the users have loaded, unless the agent already picked someone.
  useEffect(() => {
    if (assigneeTouched.current) return;
    setAssigneeIdState(defaultAssigneeId(users, conversation.assignee, user?.id));
  }, [users, user?.id, conversation.assignee]);
  const [followUp, setFollowUp] = useState(true);
  const [keepLinked, setKeepLinked] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  const { save, isSaving } = useCreateInboxEnquiry({
    conversationId: conversation.id,
    clientId: client.id,
    firstName: first,
    onCreated: (created) => {
      onCreated(created);
      onOpenChange(false);
    },
    onDone: () => onOpenChange(false),
  });
  savingRef.current = isSaving;
  const requestClose = () => {
    if (!isSaving) onOpenChange(false);
  };

  const errors = validateEnquiryForm(api.form);
  const missing = missingForClient(errors);

  const submit = async () => {
    if (isSaving) return;
    if (Object.keys(errors).length > 0 || !assigneeId) {
      setShowErrors(true);
      return;
    }
    await save({ form: api.form, assigneeId, followUp, keepLinked });
  };

  const ask = () => {
    onAskClient(askText(first, missing));
    onOpenChange(false);
  };

  return (
    <>
      <Header
        onClose={requestClose}
        subtitle={
          resolved.hasIntent
            ? "Luna filled in what it could from the chat. Check it, then save."
            : "There is no holiday request in this chat yet. Fill in what you know."
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-4">
        <div className="mb-3.5 flex items-center gap-3 rounded-xl border border-social-border px-3 py-2.5">
          <ChannelAvatar name={clientDisplayName(client) || conversation.contact.displayName} avatarUrl={client.avatarUrl ?? undefined} channel={conversation.channel} size={40} badge={false} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{clientDisplayName(client) || conversation.contact.displayName}</div>
            <div className="truncate text-[12px] text-social-muted">Existing client · {client.phoneNumber || client.email || "no contact details"}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[12px] font-semibold text-[#047857] dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Linked
          </span>
        </div>

        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">Holiday details</div>
        <EnquiryFields api={api} errors={showErrors ? errors : {}} />

        {resolved.hasIntent && quote && <ChatQuote firstName={first} text={quote.text} at={quote.at} />}
        <StillNeeded firstName={first} missing={missing} onAsk={ask} />
        <WhenYouSave
          firstName={first}
          followUp={followUp}
          onFollowUp={setFollowUp}
          keepLinked={keepLinked}
          onKeepLinked={setKeepLinked}
          assigneeId={assigneeId}
          onAssignee={setAssigneeId}
          // user_id is the deal owner; the branch comes from the saver's scope, not this field.
          error={showErrors && !assigneeId ? "Pick who this enquiry is assigned to." : undefined}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-social-border px-7 py-4">
        <span className="text-[12px] text-social-muted">You can change everything later.</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-[38px]" onClick={requestClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            className="h-[38px] bg-social-orange font-semibold text-[#1F2937] hover:bg-social-orange/90"
            data-testid="button-create-enquiry"
          >
            {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Create enquiry
          </Button>
        </div>
      </div>
    </>
  );
}

function GeneratingBody({ onClose }: { onClose(): void }) {
  return (
    <>
      <Header subtitle="Luna is reading the chat…" onClose={onClose} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-7 text-center" data-testid="drawer-enquiry-generating">
        <Loader2 className="h-5 w-5 animate-spin text-social-muted" aria-hidden="true" />
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-[13px]">Pulling the holiday details out of the conversation.</p>
        <p className="text-[12px] text-social-muted">This usually takes a few seconds.</p>
      </div>
    </>
  );
}

function DrawerBody(props: Omit<CreateEnquiryDrawerProps, "open" | "generating"> & { savingRef: MutableRefObject<boolean> }) {
  const { ready, isError, retry, resolved } = useEnquiryPrefill(props.intent, props.conversation.channel);
  if (isError) {
    return (
      <>
        <Header subtitle="Getting things ready." onClose={() => props.onOpenChange(false)} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-social-muted">
          <p className="text-[14px]">Couldn't load the lookups.</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      </>
    );
  }
  if (!ready || !resolved) {
    return (
      <>
        <Header subtitle="Getting things ready." onClose={() => props.onOpenChange(false)} />
        <div className="grid flex-1 place-items-center text-social-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </>
    );
  }
  return <DrawerForm {...props} resolved={resolved} />;
}

/** Right-hand drawer to turn a chat into an enquiry, pre-filled by Luna. */
export function CreateEnquiryDrawer({ open, onOpenChange, generating = false, ...rest }: CreateEnquiryDrawerProps) {
  const savingRef = useRef(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Closing mid-save would hide the result and invite a duplicate click.
        if (!next && savingRef.current) return;
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" hideClose className="flex w-full flex-col gap-0 p-0 text-[14px] sm:max-w-[560px]" data-testid="drawer-create-enquiry">
        {open && generating && <GeneratingBody onClose={() => onOpenChange(false)} />}
        {open && !generating && <DrawerBody {...rest} onOpenChange={onOpenChange} savingRef={savingRef} />}
      </SheetContent>
    </Sheet>
  );
}
