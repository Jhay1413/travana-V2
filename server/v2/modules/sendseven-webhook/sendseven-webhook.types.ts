// Minimal shape of a SendSeven webhook delivery we care about. The full event
// catalogue is in docs/sendseven-ai-auto-reply-plan.md §1.
export interface SsWebhookEvent {
  id?: string;
  event_id?: string;
  type?: string;
  tenant_id?: string;
  created_at?: string;
  data?: {
    message?: {
      id?: string;
      conversation_id?: string;
      channel_id?: string;
      contact_id?: string;
      direction?: "inbound" | "outbound";
      message_type?: string;
      text?: string | null;
      meta?: Record<string, unknown> | null;
    };
    conversation?: Record<string, unknown>;
    contact?: Record<string, unknown>;
  };
}

// Response from POST /webhook-endpoints (WebhookSecretResponse — secret shown once).
export interface SsWebhookEndpointCreated {
  webhook_id: string;
  secret_key: string;
  message?: string;
}
