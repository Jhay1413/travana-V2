import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { FormButton, FormCloseButton, FormHead, FormOverlay } from "@/components/shared/form-shell";
import { EnquiryFormContent, type EnquirySaveResult } from "@/features/enquiry";
import { useUsers } from "@/hooks/queries";
import { useAuth } from "@/hooks/use-auth";
import { clientDisplayName } from "@/lib/utils";
import type { NeonClient } from "@/features/client";
import type { EnquiryIntent } from "../../../api/ai-enquiry.api";
import type { Conversation } from "../../../types";
import { ChannelAvatar } from "../shared";
import { askText, missingForClient } from "./lib/ask-text";
import { defaultAssigneeId } from "./lib/default-assignee";
import { validateEnquiryForm } from "@/features/enquiry/lib/enquiry-form";
import { firstNameFor } from "./lib/first-name";
import type { ResolvedIntent } from "./lib/resolve-intent";
import { SourceChip } from "./source-chip";
import { ChatQuote, StillNeeded } from "./still-needed";
import { useCreateInboxEnquiry, type CreatedEnquiry } from "./use-create-inbox-enquiry";
import { useEnquiryPrefill } from "./use-enquiry-prefill";
import { WhenYouSave } from "./when-you-save";

export interface InboxEnquiryDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  conversation: Conversation;
  client: NeonClient;
  /** What the AI pulled from the chat; null when it found nothing or failed. */
  intent: EnquiryIntent | null;
  /** The client's last message, quoted in the dialog. */
  quote: { text: string; at: string } | null;
  /** Receives a drafted question for the reply box. */
  onAskClient(text: string): void;
  onCreated(created: CreatedEnquiry): void;
  /** Called after "Save & start quote" with the saved ids; the owner opens the quote form. */
  onStartQuote(result: EnquirySaveResult): void;
  /** True while Luna is reading the chat; the form mounts only once it is false. */
  generating?: boolean;
}

interface FormProps extends Omit<InboxEnquiryDialogProps, "open" | "intent" | "generating"> {
  resolved: ResolvedIntent;
  /** Reports "a save is in flight" so the overlay can ignore dismissals meanwhile. */
  onSavingChange(saving: boolean): void;
}

const SUBTITLE_READY = "Luna filled in what it could from the chat. Check it, then save.";
const SUBTITLE_EMPTY = "There is no holiday request in this chat yet. Fill in what you know.";

function StateBody({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="fm-enq__body" style={{ alignItems: "center", justifyContent: "center", minHeight: 280, textAlign: "center" }} data-testid={testId}>
      {children}
    </div>
  );
}

function LinkedClient({ client, conversation }: { client: NeonClient; conversation: Conversation }) {
  const name = clientDisplayName(client) || conversation.contact.displayName;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E3E8EF] px-3 py-2.5">
      <ChannelAvatar name={name} avatarUrl={client.avatarUrl ?? undefined} channel={conversation.channel} size={40} badge={false} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{name}</div>
        <div className="truncate text-[12px] text-[#6B7686]">Existing client · {client.phoneNumber || client.email || "no contact details"}</div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[12px] font-semibold text-[#047857]">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Linked
      </span>
    </div>
  );
}

function ReadyForm({ resolved, conversation, client, quote, onAskClient, onCreated, onStartQuote, onOpenChange, onSavingChange }: FormProps) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
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
  useEffect(() => {
    onSavingChange(isSaving);
  }, [isSaving, onSavingChange]);

  return (
    <EnquiryFormContent
      isSaving={isSaving}
      onClose={() => {
        if (!isSaving) onOpenChange(false);
      }}
      onStartQuote={onStartQuote}
      onSubmit={async (_data, { form, startQuote }) => {
        // user_id is the deal owner; the branch comes from the saver's scope, not this field.
        if (!assigneeId) return;
        const created = await save({ form, assigneeId, followUp, keepLinked });
        if (created && startQuote) return { enquiryId: created.enquiryId, transactionId: created.transactionId, clientId: created.clientId };
      }}
      inbox={{
        init: { form: resolved.form, sources: resolved.sources, titleIsAuto: resolved.titleIsAuto },
        subtitle: resolved.hasIntent ? SUBTITLE_READY : SUBTITLE_EMPTY,
        header: <LinkedClient client={client} conversation={conversation} />,
        renderChip: (kind) => <SourceChip kind={kind} />,
        renderBand: ({ form, showErrors }) => {
          const missing = missingForClient(validateEnquiryForm(form, { strict: true }));
          return (
            <div>
              {resolved.hasIntent && quote && <ChatQuote firstName={first} text={quote.text} at={quote.at} />}
              <StillNeeded
                firstName={first}
                missing={missing}
                onAsk={() => {
                  onAskClient(askText(first, missing));
                  onOpenChange(false);
                }}
              />
              <WhenYouSave
                firstName={first}
                followUp={followUp}
                onFollowUp={setFollowUp}
                keepLinked={keepLinked}
                onKeepLinked={setKeepLinked}
                assigneeId={assigneeId}
                onAssignee={setAssigneeId}
                error={showErrors && !assigneeId ? "Pick who this enquiry is assigned to." : undefined}
              />
            </div>
          );
        },
      }}
    />
  );
}

function GeneratingBody({ onClose }: { onClose(): void }) {
  return (
    <>
      <FormHead
        icon={<Sparkles size={22} color="#D97706" aria-hidden="true" />}
        title="Create enquiry from this chat"
        subtitle="Luna is reading the chat…"
        right={<FormCloseButton onClick={onClose} />}
      />
      <StateBody testId="drawer-enquiry-generating">
        <Loader2 className="h-5 w-5 animate-spin text-[#6B7686]" aria-hidden="true" />
        <p className="text-[13px]">Pulling the holiday details out of the conversation.</p>
        <p className="text-[12px] text-[#6B7686]">This usually takes a few seconds.</p>
      </StateBody>
    </>
  );
}

function PrefillBody(props: Omit<InboxEnquiryDialogProps, "open" | "generating"> & { onSavingChange(saving: boolean): void }) {
  const { ready, isError, retry, resolved } = useEnquiryPrefill(props.intent, props.conversation.channel);
  const close = () => props.onOpenChange(false);
  if (isError) {
    return (
      <>
        <FormHead title="Create enquiry from this chat" subtitle="Getting things ready." right={<FormCloseButton onClick={close} />} />
        <StateBody>
          <p className="text-[14px] text-[#6B7686]">Couldn't load the lookups.</p>
          <FormButton small onClick={retry}>
            Retry
          </FormButton>
        </StateBody>
      </>
    );
  }
  if (!ready || !resolved) {
    return (
      <>
        <FormHead title="Create enquiry from this chat" subtitle="Getting things ready." right={<FormCloseButton onClick={close} />} />
        <StateBody>
          <Loader2 className="h-5 w-5 animate-spin text-[#6B7686]" aria-hidden="true" />
        </StateBody>
      </>
    );
  }
  return <ReadyForm {...props} resolved={resolved} />;
}

/** Centred pop-up to turn a chat into an enquiry, pre-filled by Luna. */
export function InboxEnquiryDialog({ open, onOpenChange, generating = false, ...rest }: InboxEnquiryDialogProps) {
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  return (
    <FormOverlay
      label="Create enquiry from this chat"
      onClose={() => onOpenChange(false)}
      // Closing mid-save would hide the result and invite a duplicate click.
      preventClose={saving}
      variant="enquiry"
      data-testid="drawer-create-enquiry"
    >
      {generating ? <GeneratingBody onClose={() => onOpenChange(false)} /> : <PrefillBody {...rest} onOpenChange={onOpenChange} onSavingChange={setSaving} />}
    </FormOverlay>
  );
}
