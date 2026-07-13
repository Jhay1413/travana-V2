export type BotMode = "draft" | "send";

export interface BotConfig {
  id: string;
  orgId: string;
  name: string | null;
  avatarUrl: string | null;
  persona: string | null;
  preferredResponse: string | null;
  greeting: string | null;
  signOff: string | null;
  language: string;
  handoffInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoReplyStatus {
  enabled: boolean;
  mode: BotMode;
  provisioned: boolean;
}

export interface BotConfigResponse {
  config: BotConfig | null;
  autoReply: AutoReplyStatus;
}

export type BotConfigUpdatePayload = Partial<
  Pick<
    BotConfig,
    "name" | "avatarUrl" | "persona" | "preferredResponse" | "greeting" | "signOff" | "language" | "handoffInstructions"
  >
>;

export interface KbEntry {
  id: string;
  orgId: string;
  title: string;
  content: string;
  category: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbEntryCreatePayload {
  title: string;
  content: string;
  category?: string | null;
  isActive?: boolean;
}

export type KbEntryUpdatePayload = Partial<KbEntryCreatePayload>;
