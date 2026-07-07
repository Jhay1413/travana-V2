import { decrypt, encrypt } from "../../utils/encryption";
import { AppError } from "../../utils/error-handler";
import { runWithSendSevenConfig, sendSevenRequest, type SendSevenConfig } from "../../utils/sendseven";
import { conversationIntegrationRepository } from "./conversation-integration.repository";

// Business logic for the per-org SendSeven integration: encrypting tokens,
// resolving the request-time config, and reporting connection status.

function maskToken(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export interface IntegrationStatus {
  configured: boolean;
  source: "org" | "env" | "none";
  isActive: boolean;
  baseUrl: string | null;
  tokenMasked: string | null;
  updatedAt: string | null;
}

export const conversationIntegrationService = {
  // Called by middleware on every conversations/messages request. Returns the
  // org's config, or null so the shared client falls back to the env token.
  async resolveConfig(orgId: string): Promise<SendSevenConfig | null> {
    if (!orgId) return null;
    const row = await conversationIntegrationRepository.findByOrg(orgId);
    if (!row || !row.isActive) return null;
    try {
      const token = decrypt(row.encryptedToken);
      const baseUrl = (row.baseUrl || process.env.CONVERSATIONS_API_URL || "").replace(/\/$/, "");
      if (!baseUrl || !token) return null;
      return { baseUrl, token };
    } catch {
      // Undecryptable token (e.g. rotated EMAIL_ENCRYPTION_KEY) — treat as unset.
      return null;
    }
  },

  async getStatus(orgId: string): Promise<IntegrationStatus> {
    const row = orgId ? await conversationIntegrationRepository.findByOrg(orgId) : null;
    if (row?.isActive) {
      let masked: string | null = null;
      try {
        masked = maskToken(decrypt(row.encryptedToken));
      } catch {
        masked = null;
      }
      return {
        configured: true,
        source: "org",
        isActive: true,
        baseUrl: row.baseUrl ?? process.env.CONVERSATIONS_API_URL ?? null,
        tokenMasked: masked,
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      };
    }
    // No org token — is there a global env fallback?
    if (process.env.CONVERSATIONS_API_URL && process.env.CONVERSATIONS_API_TOKEN) {
      return { configured: true, source: "env", isActive: true, baseUrl: process.env.CONVERSATIONS_API_URL, tokenMasked: null, updatedAt: null };
    }
    return { configured: false, source: "none", isActive: false, baseUrl: null, tokenMasked: null, updatedAt: null };
  },

  async setToken(orgId: string, token: string, baseUrl: string | null, userId: string | null): Promise<IntegrationStatus> {
    if (!orgId) throw new AppError("No organisation context", 400);
    const trimmed = token.trim();
    if (!trimmed) throw new AppError("Token is required", 400);
    await conversationIntegrationRepository.upsert({
      orgId,
      encryptedToken: encrypt(trimmed),
      baseUrl: baseUrl?.trim() ? baseUrl.trim().replace(/\/$/, "") : null,
      createdByUserId: userId,
    });
    return this.getStatus(orgId);
  },

  async remove(orgId: string): Promise<void> {
    if (!orgId) throw new AppError("No organisation context", 400);
    await conversationIntegrationRepository.deleteByOrg(orgId);
  },

  // Lightweight connectivity check using the org's resolved config.
  async testConnection(orgId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.resolveConfig(orgId);
    const effective = cfg ?? (process.env.CONVERSATIONS_API_URL && process.env.CONVERSATIONS_API_TOKEN
      ? { baseUrl: process.env.CONVERSATIONS_API_URL.replace(/\/$/, ""), token: process.env.CONVERSATIONS_API_TOKEN }
      : null);
    if (!effective) return { ok: false, message: "No SendSeven token configured for this organisation." };
    try {
      await new Promise<void>((resolve, reject) => {
        runWithSendSevenConfig(effective, () => {
          sendSevenRequest("GET", "/conversations", { query: { page: 1, page_size: 1 } })
            .then(() => resolve())
            .catch(reject);
        });
      });
      return { ok: true, message: "Connected to SendSeven successfully." };
    } catch (err) {
      const message = err instanceof AppError ? err.message : "Failed to reach SendSeven.";
      return { ok: false, message };
    }
  },
};
