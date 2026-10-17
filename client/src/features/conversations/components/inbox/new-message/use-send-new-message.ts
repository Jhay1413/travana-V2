import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/features/social";
import {
  useCheckExistingConversation,
  useInitiateConversation,
  useOpenOrCreateConversation,
} from "../../../api/use-conversations-mutations";
import { useSendMessage } from "../../../api/use-messages";
import { bodyToHtml } from "./new-message-validation";

export interface SendNewMessageInput {
  contactId: string;
  channelId: string;
  channelType: string;
  subject: string;
  body: string;
  firstName: string;
}

export function useSendNewMessage(onDone: () => void) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const sendMessage = useSendMessage();
  const checkExisting = useCheckExistingConversation();
  const openOrCreate = useOpenOrCreateConversation();
  const initiate = useInitiateConversation();
  const [isSending, setIsSending] = useState(false);

  const fail = (description: string) => toast({ title: "Couldn't send", description, variant: "destructive" });

  const send = async (input: SendNewMessageInput): Promise<boolean> => {
    const { contactId, channelId, channelType, subject, body, firstName } = input;
    const content = body.trim();
    const isEmail = channelType === "email";
    setIsSending(true);
    try {
      const existing = await checkExisting.mutateAsync({ contact_id: contactId, channel_id: channelId });
      let conversationId: string;

      if (existing.has_existing_open && existing.existing_open_conversation_id) {
        conversationId = existing.existing_open_conversation_id;
        await sendMessage.mutateAsync({
          conversation_id: conversationId,
          text: content,
          subject: isEmail ? subject.trim() : undefined,
        });
      } else {
        const opened = await openOrCreate.mutateAsync({
          contact_id: contactId,
          channel_id: channelId,
          reopen_existing: true,
        });
        conversationId = opened.conversation_id;
        if (isEmail) {
          const res = await initiate.mutateAsync({
            contact_id: contactId,
            channel_id: channelId,
            message_type: "email",
            email: { subject: subject.trim(), body_html: bodyToHtml(content) },
          });
          if (res.requires_template) {
            toast({
              title: "Conversation opened, message not sent",
              description:
                "WhatsApp needs an approved template for this contact right now. Try SMS or email. The conversation was opened.",
              variant: "destructive",
            });
            return false;
          }
          if (res.error) {
            fail(res.error);
            return false;
          }
          conversationId = res.conversation_id || conversationId;
        } else {
          await sendMessage.mutateAsync({ conversation_id: conversationId, text: content });
        }
      }

      toast({ title: `Sent to ${firstName}` });
      onDone();
      navigate(`/conversations?conversation=${conversationId}`);
      return true;
    } catch (err) {
      fail(errorMessage(err, "Something went wrong sending the message."));
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return { send, isSending };
}
