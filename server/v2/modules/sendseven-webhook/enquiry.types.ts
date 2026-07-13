// The enquiry slot-filling types live in ai-conversation (the shared, driver-
// agnostic "brain" module) so they can be reused by other conversational
// drivers without depending on sendseven-webhook. Re-exported here so existing
// sendseven-webhook imports (`from "./enquiry.types"`) keep working unchanged.
export type { EnquirySlots, ClientDetails, AiTurn } from "../ai-conversation/ai-conversation.types";
