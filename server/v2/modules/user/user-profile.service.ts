import { userProfileRepository } from "./user-profile.repository";
import { userRepository } from "./user.repository";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : (scope.orgId || null);
}

async function assertUserInScope(targetUserId: string, scope: Scope) {
  const callerOrgId = effectiveOrgId(scope);
  if (!callerOrgId) return;
  const target = await userRepository.findById(targetUserId);
  if (!target || target.orgId !== callerOrgId) {
    throw new AppError("Profile not found", 404);
  }
}

export const userProfileService = {
  async getMyProfile(userId: string) {
    return (await userProfileRepository.findByUserId(userId)) ?? null;
  },

  async getProfile(targetUserId: string, scope: Scope) {
    await assertUserInScope(targetUserId, scope);
    return (await userProfileRepository.findByUserId(targetUserId)) ?? null;
  },

  async upsertMyProfile(userId: string, input: Parameters<typeof userProfileRepository.upsert>[1]) {
    return userProfileRepository.upsert(userId, input);
  },
};
