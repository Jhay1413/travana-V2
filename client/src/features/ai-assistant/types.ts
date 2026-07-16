export type BotMode = "draft" | "send";

export type BotAudience = "general" | "sales" | "admin";

export interface BotRule {
  text: string;
  audience: BotAudience;
  isActive?: boolean;
}

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
  rules?: BotRule[];
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
    | "name"
    | "avatarUrl"
    | "persona"
    | "preferredResponse"
    | "greeting"
    | "signOff"
    | "language"
    | "handoffInstructions"
    | "rules"
  >
>;

export interface KbEntry {
  id: string;
  orgId: string;
  title: string;
  content: string;
  category: string | null;
  audience: BotAudience;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KbEntryCreatePayload {
  title: string;
  content: string;
  category?: string | null;
  audience?: BotAudience;
  isActive?: boolean;
}

export type KbEntryUpdatePayload = Partial<KbEntryCreatePayload>;
