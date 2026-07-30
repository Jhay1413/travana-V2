import { isPlatformConfigured, platformRequest } from "../../utils/sendseven";
import { organizationRepository } from "../organization/organization.repository";
import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { conversationIntegrationRepository } from "./conversation-integration.repository";

// Auto-provisions a SendSeven sub-account (tenant) for an org during onboarding,
// using the platform-level parent credential (SENDSEVEN_PLATFORM_TOKEN). It only
// creates the tenant and links its id — no per-tenant API token is minted. Per
// SendSeven's multi-tenancy model, the org's inbox drives this sub-account by
// reusing the parent token with an `X-Tenant-ID: <tenantId>` header (handled in
// the request layer). See docs.sendseven.com/multi-tenancy/create-subaccounts.

interface SsTenantCreate {
  name: string;
  slug?: string | null;
  company_email?: string | null;
  default_timezone?: string | null;
  // Required when the parent owns more than one billing account; SendSeven infers
  // it otherwise. Sourced from SENDSEVEN_BILLING_ACCOUNT_ID.
  billing_account_id?: string | null;
}

interface SsTenantResponse {
  id: string;
  name: string;
  slug: string;
  is_trial?: boolean;
  trial_ends_at?: string | null;
}

// Registers the org's webhook so its inbox is live from day one — new messages
// stream in over SSE and staff get notified without anyone visiting a settings
// page. Connects with the AI left OFF (connectWebhook doesn't touch that flag,
// and the column defaults to false): real-time messaging is infrastructure every
// org wants, auto-replying on a customer's behalf is an explicit decision.
//
// Best-effort and idempotent: skipped when already connected, and any failure
// (commonly no HTTPS PUBLIC_BASE_URL in dev) is logged, never thrown — a webhook
// that didn't register must not break sign-up. The Organisation → Messaging
// toggle is the manual recovery path.
async function ensureWebhookConnected(orgId: string, alreadyConnected: boolean): Promise<void> {
  if (alreadyConnected) return;
  try {
    const { url } = await sendsevenWebhookService.connectWebhook(orgId);
    console.log(`[sendseven] Auto-connected webhook for org ${orgId} → ${url} (AI auto-reply left off).`);
  } catch (err) {
    console.warn(
      `[sendseven] Webhook auto-connect skipped for org ${orgId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export const sendsevenProvisioningService = {
  // Idempotent: safe to call multiple times. Returns the linked tenant id, or
  // null when provisioning is skipped (not configured / org missing).
  async provisionForOrg(orgId: string, opts: { companyEmail?: string } = {}): Promise<{ tenantId: string } | null> {
    if (!orgId) return null;

    // Already linked → the tenant exists, but the webhook may still be missing
    // (an org provisioned before auto-connect existed, or a failed attempt), so
    // give it another chance rather than returning early.
    const existing = await conversationIntegrationRepository.findByOrg(orgId);
    if (existing?.tenantId) {
      await ensureWebhookConnected(orgId, !!existing.webhookSecret);
      return { tenantId: existing.tenantId };
    }

    // No platform credential configured → feature not enabled; skip quietly.
    if (!isPlatformConfigured()) {
      console.warn("[sendseven] SENDSEVEN_PLATFORM_TOKEN not set — skipping tenant auto-provisioning.");
      return null;
    }

    const org = await organizationRepository.findById(orgId);
    if (!org) return null;

    const billingAccountId = process.env.SENDSEVEN_BILLING_ACCOUNT_ID?.trim() || null;
    const body: SsTenantCreate = {
      name: org.name,
      slug: org.slug,
      company_email: opts.companyEmail ?? null,
      default_timezone: "Europe/London",
      billing_account_id: billingAccountId,
    };
    const tenant = await platformRequest<SsTenantResponse>("POST", "/tenants", { body });

    await conversationIntegrationRepository.setTenantId(orgId, tenant.id);
    console.log(`[sendseven] Provisioned sub-account ${tenant.id} for org ${orgId} (${org.name}).`);

    // No per-tenant token to mint: the inbox reaches this sub-account via the
    // parent token + X-Tenant-ID header (see conversationIntegrationService.resolveConfig).

    await ensureWebhookConnected(orgId, false);

    return { tenantId: tenant.id };
  },

  // Fire-and-forget: never let provisioning failures affect the caller (e.g.
  // onboarding). Logs and swallows.
  provisionForOrgSafe(orgId: string, opts: { companyEmail?: string } = {}): void {
    this.provisionForOrg(orgId, opts).catch((err) => {
      console.error(
        `[sendseven] Tenant auto-provisioning failed for org ${orgId}:`,
        err instanceof Error ? err.message : err,
      );
    });
  },
};
