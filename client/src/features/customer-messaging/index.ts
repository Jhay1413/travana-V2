// Public surface of the customer-messaging (staff) feature: the "Send by" choice, the staff send, the client page history.
export { SendByChoice } from "./components/send-by-choice";
export { hold, heldFor, type Held } from "./lib/scoped-state";
export { WhatsappFallbackPanel } from "./components/whatsapp-fallback-panel";
export { MessageLogList, MessageLogSheet, MESSAGE_LOG_EMPTY_TEXT } from "./components/message-log-list";
export { useSendAvailability, useStaffSend, useMessageLogPreview, useMessageLogPages, staffMessagingKeys } from "./api/use-customer-messaging-staff";
export { canSendBy, channelLabel, effectiveChannel, initialChannel, toastForResult } from "./lib/send-by";
export { formatLogRow, formatLogTime, purposeLabel, statusText } from "./lib/message-log-format";
export type {
  ChannelAvailability,
  MessageLogEntry,
  MessageLogPage,
  SendAvailability,
  SendChannel,
  StaffMessagePurpose,
  StaffSendInput,
  StaffSendResult,
  WhatsappFallback,
  WhatsappFallbackReason,
} from "./types";
