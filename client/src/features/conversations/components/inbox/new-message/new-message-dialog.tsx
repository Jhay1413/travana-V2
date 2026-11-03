import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNeonClient, type NeonClient } from "@/features/client";
import { useChannels } from "../../../api/use-channels";
import { useClientContactLink } from "../../../api/use-contact-link";
import { useUpdateTemplate } from "../../../api/use-whatsapp-updates";
import type { SsChannel } from "../../../api/channels.api";
import { ClientPicker } from "./client-picker";
import { SendByCards } from "./send-by-cards";
import { useSendNewMessage } from "./use-send-new-message";
import { validateNewMessage, type NewMessageErrors } from "./new-message-validation";
import { whatsappSendBlocked, whatsappSendState, type WhatsappSendStateInput } from "./whatsapp-send-state";

export interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClientId?: string;
}

export function NewMessageDialog({ open, onOpenChange, initialClientId }: NewMessageDialogProps) {
  const [picked, setPicked] = useState<NeonClient | null>(null);
  const [channel, setChannel] = useState<SsChannel | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<NewMessageErrors>({});

  const { data: channels = [] } = useChannels(open);
  const { data: initialClient } = useNeonClient(open ? (initialClientId ?? "") : "");
  const client = picked;
  const seededRef = useRef(false);
  const clientId = client?.id ?? null;
  const link = useClientContactLink(clientId, open);
  const contactId = link.data?.contactId ?? null;
  const updateTemplate = useUpdateTemplate(open);
  const sendStateInput: WhatsappSendStateInput = {
    channelType: channel?.channel_type ?? null,
    linkLoaded: !!clientId && link.isSuccess,
    hasContact: !!contactId,
    phone: client?.phoneNumber ?? "",
    templateConfigured: updateTemplate.data?.configured,
    firstName: client?.firstName?.trim() || "This client",
  };
  const sendState = whatsappSendState(sendStateInput);
  const sendBlocked = whatsappSendBlocked(sendState, sendStateInput);

  const { send, isSending } = useSendNewMessage(() => onOpenChange(false));

  useEffect(() => {
    if (open) {
      seededRef.current = false;
      setPicked(null);
      setChannel(null);
      setSubject("");
      setBody("");
      setErrors({});
    }
  }, [open]);

  // Seed the chip from the initial client once it loads, so it stays removable.
  useEffect(() => {
    if (open && initialClientId && initialClient && !seededRef.current) {
      seededRef.current = true;
      setPicked(initialClient);
    }
  }, [open, initialClientId, initialClient]);

  const handleSend = async () => {
    const found = validateNewMessage({
      clientId,
      contactId,
      channelId: channel?.id ?? null,
      channelType: channel?.channel_type ?? null,
      subject,
      body,
    });
    setErrors(found);
    if (Object.keys(found).length > 0 || !client || !channel || sendBlocked) return;
    await send({
      clientId: client.id,
      contactId,
      channelId: channel.id,
      channelType: channel.channel_type,
      subject,
      body,
      firstName: client.firstName,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] text-sm">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Start a conversation with a client.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>To</Label>
            <ClientPicker
              value={client}
              onChange={(c) => {
                setPicked(c);
                setErrors((e) => ({ ...e, clientId: undefined }));
              }}
              error={errors.clientId}
            />
            {sendState.kind === "error" && <p className="text-xs text-destructive">{sendState.message}</p>}
            {sendState.kind === "info" && <p className="text-xs text-social-muted">{sendState.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Send by</Label>
            <SendByCards
              channels={channels}
              selectedChannelId={channel?.id ?? null}
              onSelect={(c) => {
                setChannel(c);
                setErrors((e) => ({ ...e, channel: undefined }));
              }}
              error={errors.channel}
            />
          </div>

          {channel?.channel_type === "email" && (
            <div className="space-y-1.5">
              <Label htmlFor="nm-subject">Subject</Label>
              <Input
                id="nm-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your holiday options"
                className="text-sm"
              />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nm-body">Message</Label>
            <Textarea id="nm-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm" />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-social-muted">Send now</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={isSending || sendBlocked || link.isLoading}
              className="bg-social-orange text-social-orange-text hover:bg-social-orange/90"
            >
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
