import { AppError } from "../../utils/error-handler";
import { ukYearMonth } from "../../utils/london-dates";
import { organizationRepository } from "../organization/organization.repository";
import { branchRepository } from "../branch/branch.repository";
import { branchService } from "../branch/branch.service";
import { buildDefaultBranchSchedule } from "../branch/branch-defaults";
import { inviteService } from "../invite/invite.service";
import { onboardingSetupRepository } from "./onboarding-setup.repository";
import type { Organization } from "@shared/schema";
import type {
  BusinessInput,
  ManagerInviteOutcome,
  OnboardingActor,
  OnboardingSettings,
  OnboardingState,
  ShopInput,
  ShopResult,
} from "./onboarding-setup.types";

type SettingsBag = Record<string, unknown>;

function asBag(value: unknown): SettingsBag {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SettingsBag) : {};
}

/** Orgs created before the wizard have no onboarding key: they count as complete. */
function readOnboarding(settings: SettingsBag): OnboardingSettings {
  const raw = asBag(settings.onboarding);
  if (raw.status !== "pending" && raw.status !== "complete") return { status: "complete", version: 1 };
  return raw as unknown as OnboardingSettings;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function loadOrg(orgId: string): Promise<Organization> {
  const org = await organizationRepository.findById(orgId);
  if (!org) throw new AppError("Organization not found", 404);
  return org;
}

/** The wizard only edits an org still in setup; established orgs are never touched. */
function assertPending(onboarding: OnboardingSettings): void {
  if (onboarding.status !== "pending") {
    throw new AppError("Onboarding is already complete", 409, true, "ONBOARDING_NOT_PENDING");
  }
}

async function loadPendingOrg(orgId: string): Promise<{ org: Organization; onboarding: OnboardingSettings }> {
  const org = await loadOrg(orgId);
  const onboarding = readOnboarding(asBag(org.settings));
  assertPending(onboarding);
  return { org, onboarding };
}

function rowError(err: unknown): { error: string; code?: string } {
  if (err instanceof AppError) return { error: err.message, code: err.code };
  console.error("[onboarding] shop row failed:", err);
  return { error: "Could not save this shop" };
}

export const onboardingSetupService = {
  async getState(orgId: string): Promise<OnboardingState> {
    const org = await loadOrg(orgId);
    // The owner is the org's own admin, not the requester (a platform admin may be impersonating).
    const owner = await onboardingSetupRepository.findOwner(orgId);
    if (!owner) throw new AppError("Organization owner not found", 404);

    const settings = asBag(org.settings);
    const onboarding = readOnboarding(settings);
    const profile = asBag(settings.profile);
    const shops = await branchRepository.findAllByOrg(orgId, "shop");

    const { year, month } = ukYearMonth(new Date());
    const [others, hasTargets, hasEnquiry] = await Promise.all([
      onboardingSetupRepository.countOtherUsers(orgId, owner.id),
      onboardingSetupRepository.hasTargetForMonth(orgId, year, month),
      onboardingSetupRepository.hasTransaction(orgId),
    ]);

    return {
      status: onboarding.status,
      businessType: onboarding.businessType ?? null,
      business: {
        name: org.name,
        phone: str(profile.phone),
        address: str(profile.addressLine1),
        website: str(profile.website),
        email: str(profile.email),
      },
      owner: { firstName: owner.firstName, lastName: owner.lastName, email: owner.email },
      branches: shops.map((b) => ({
        id: b.id,
        name: b.name,
        phone: b.phone ?? "",
        address: b.address ?? "",
        email: b.email ?? "",
        isDefault: b.isDefault,
        isPlaceholder: Boolean(onboarding.placeholderBranchId) && b.id === onboarding.placeholderBranchId && onboarding.defaultBranchClaimed !== true,
      })),
      homeworkerCommission: org.homeworkerCommission ?? null,
      checklist: {
        account: true,
        business: Boolean(str(profile.phone).trim() && str(profile.addressLine1).trim()),
        invites: others > 0,
        targets: hasTargets,
        enquiry: hasEnquiry,
      },
    };
  },

  async saveBusiness(actor: OnboardingActor, input: BusinessInput): Promise<OnboardingState> {
    const { onboarding } = await loadPendingOrg(actor.orgId);

    const name = input.businessName.trim();
    const phone = input.phone.trim();
    const address = input.address.trim();
    const email = input.email.trim();

    // Only the signup placeholder is mirrored, and only while no shop has claimed it.
    const placeholderId = onboarding.placeholderBranchId;
    const mirror = input.businessType === "single" && onboarding.defaultBranchClaimed !== true;

    await onboardingSetupRepository.saveBusiness({
      orgId: actor.orgId,
      name,
      // Merged into the existing profile in SQL, so other profile keys survive.
      profile: { phone, addressLine1: address, website: input.website.trim(), email },
      businessType: input.businessType,
      branchCopy: mirror && placeholderId ? { id: placeholderId, fields: { name, phone, address, email } } : undefined,
    });

    return this.getState(actor.orgId);
  },

  async addShops(actor: OnboardingActor, shops: ShopInput[], requestOrigin?: string | null): Promise<{ results: ShopResult[] }> {
    await loadPendingOrg(actor.orgId);
    const owner = await onboardingSetupRepository.findOwner(actor.orgId);
    const ownerEmail = owner?.email.toLowerCase().trim() ?? "";

    const results: ShopResult[] = [];
    for (let index = 0; index < shops.length; index++) {
      const shop = shops[index];
      const fields = {
        name: shop.name.trim(),
        phone: shop.phone.trim(),
        address: shop.address.trim(),
        email: shop.email.trim().toLowerCase(),
      };

      let saved: { branchId: string; status: "created" | "updated" };
      try {
        saved = await this.saveShop(actor.orgId, fields);
      } catch (err) {
        results.push({ index, status: "error", ...rowError(err), managerInvite: "not_attempted" });
        continue;
      }

      const invite = await this.inviteManager(actor, saved.branchId, shop.managerEmail, ownerEmail, requestOrigin);
      results.push({ index, ...saved, ...invite });
    }

    return { results };
  },

  /**
   * One shop, serialised per org: a shop with the same name is updated (so a retried
   * submit never duplicates); otherwise the signup placeholder is claimed once; otherwise
   * a branch is created, with the plan limit counted under the same lock.
   */
  async saveShop(
    orgId: string,
    fields: { name: string; phone: string; address: string; email: string },
  ): Promise<{ branchId: string; status: "created" | "updated" }> {
    return onboardingSetupRepository.withOrgLock(orgId, async (tx) => {
      const onboarding = readOnboarding({ onboarding: await onboardingSetupRepository.readOnboarding(orgId, tx) });
      assertPending(onboarding);

      const existing = await branchRepository.findAllByOrg(orgId, "shop", tx);
      const placeholderId = onboarding.placeholderBranchId;
      const placeholderOpen = Boolean(placeholderId) && onboarding.defaultBranchClaimed !== true;
      const sameName = existing.find((b) => b.name.trim().toLowerCase() === fields.name.toLowerCase());
      const reuse = sameName ?? (placeholderOpen ? existing.find((b) => b.id === placeholderId) : undefined);

      if (reuse) {
        const updated = await branchRepository.update(reuse.id, fields, orgId, tx);
        if (!updated) throw new AppError("Branch not found", 404);
        if (placeholderOpen && placeholderId && reuse.id === placeholderId) {
          await onboardingSetupRepository.claimPlaceholder(orgId, placeholderId, tx);
        }
        return { branchId: updated.id, status: "updated" as const };
      }

      // branchService.create enforces the plan's branch limit.
      const created = await branchService.create({ ...fields, ...buildDefaultBranchSchedule() }, orgId, tx);
      return { branchId: created.id, status: "created" as const };
    });
  },

  async inviteManager(
    actor: OnboardingActor,
    branchId: string,
    managerEmailRaw: string,
    ownerEmail: string,
    requestOrigin?: string | null,
  ): Promise<{ managerInvite: ManagerInviteOutcome; managerInviteError?: string }> {
    const email = managerEmailRaw.trim().toLowerCase();
    if (!email || email === ownerEmail) return { managerInvite: "skipped" };
    try {
      await inviteService.send({ email, branchId, orgRole: "branch_manager" }, actor, requestOrigin);
      return { managerInvite: "sent" };
    } catch (err) {
      return { managerInvite: "error", managerInviteError: rowError(err).error };
    }
  },

  /** percent is validated as a 0-100 integer or null by the Zod middleware. */
  async setHomeworkerCommission(orgId: string, percent: number | null): Promise<{ homeworkerCommission: number | null }> {
    await loadPendingOrg(orgId);
    const org = await organizationRepository.update(orgId, { homeworkerCommission: percent });
    if (!org) throw new AppError("Organization not found", 404);
    return { homeworkerCommission: org.homeworkerCommission ?? null };
  },

  async complete(orgId: string): Promise<{ status: "complete" }> {
    await loadPendingOrg(orgId);
    await organizationRepository.mergeSettingsSection(orgId, "onboarding", {
      status: "complete",
      completedAt: new Date().toISOString(),
    });
    return { status: "complete" };
  },
};
