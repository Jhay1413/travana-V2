import { decrypt, encrypt } from "../../utils/encryption";
import { AppError } from "../../utils/error-handler";
import { platformConfig, runWithSendSevenConfig, sendSevenRequest, type SendSevenConfig } from "../../utils/sendseven";
import { conversationIntegrationRepository } from "./conversation-integration.repository";

// Business logic for the per-org SendSeven integration: encrypting tokens,
// resolving the request-time config, and reporting connection status.

function maskToken(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export interface IntegrationStatus {
  configured: boolean;
  // "org"    → a standalone token pasted for this org (manual override)
  // "tenant" → managed SendSeven sub-account reached via the parent token + X-Tenant-ID
  // "env"    → the platform-wide fallback token
  // "none"   → nothing configured
  source: "org" | "tenant" | "env" | "none";
  isActive: boolean;
  baseUrl: string | null;
  tokenMasked: string | null;
  updatedAt: string | null;
  /** SendSeven tenant this org is linked to (auto-provisioned on onboarding). */
  tenantId: string | null;
}

export interface IntegrationSummary {
  orgId: string;
  tenantId: string | null;
  hasToken: boolean;
  isActive: boolean;
}

export const conversationIntegrationService = {
  // Per-org summary across all orgs (platform-admin org list) — never returns tokens.
  async listStatuses(): Promise<IntegrationSummary[]> {
    const rows = await conversationIntegrationRepository.findAll();
    return rows.map((r) => ({
      orgId: r.orgId,
      tenantId: r.tenantId ?? null,
      hasToken: !!r.encryptedToken,
      isActive: r.isActive,
    }));
  },

  // Called by middleware on every conversations/messages request. Returns the
  // org's config, or null so the shared client falls back to the env token.
  //
  // Precedence:
  //   1. Manual per-org token (standalone tenant, e.g. an org outside our billing
  //      account) — used verbatim, no X-Tenant-ID.
  //   2. Managed sub-account — the parent (platform) token targeting the org's
  //      linked tenantId via X-Tenant-ID.
  //   3. null → shared client falls back to the env token.
  async resolveConfig(orgId: string): Promise<SendSevenConfig | null> {
    if (!orgId) return null;
    const row = await conversationIntegrationRepository.findByOrg(orgId);

    // 1. Manual override token.
    if (row?.isActive && row.encryptedToken) {
      try {
        const token = decrypt(row.encryptedToken);
        const baseUrl = (row.baseUrl || process.env.CONVERSATIONS_API_URL || "").replace(/\/$/, "");
        if (baseUrl && token) return { baseUrl, token };
      } catch {
        // Undecryptable token (e.g. rotated EMAIL_ENCRYPTION_KEY) — fall through
        // to the managed sub-account path.
      }
    }

    // 2. Managed sub-account via the parent token + X-Tenant-ID.
    if (row?.tenantId) {
      const parent = platformConfig();
      if (parent) return { baseUrl: parent.baseUrl, token: parent.token, tenantId: row.tenantId };
    }

    return null;
  },

  async getStatus(orgId: string): Promise<IntegrationStatus> {
    const row = orgId ? await conversationIntegrationRepository.findByOrg(orgId) : null;
    const tenantId = row?.tenantId ?? null;

    // Org has its own token → the tenant-isolated path.
    if (row?.isActive && row.encryptedToken) {
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
        tenantId,
      };
    }
    // Managed sub-account: linked tenant reached via the parent token + X-Tenant-ID.
    const parent = platformConfig();
    if (tenantId && parent) {
      return {
        configured: true,
        source: "tenant",
        isActive: true,
        baseUrl: parent.baseUrl ?? process.env.CONVERSATIONS_API_URL ?? null,
        tokenMasked: null,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
        tenantId,
      };
    }
    // No org/tenant config — is there a global env fallback?
    if (process.env.CONVERSATIONS_API_URL && process.env.CONVERSATIONS_API_TOKEN) {
      return { configured: true, source: "env", isActive: true, baseUrl: process.env.CONVERSATIONS_API_URL, tokenMasked: null, updatedAt: null, tenantId };
    }
    return { configured: false, source: "none", isActive: false, baseUrl: null, tokenMasked: null, updatedAt: null, tenantId };
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
