import { userRepository } from "./user.repository";
import { AppError } from "../../utils/error-handler";
import type { User, InsertUser } from "./user.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : (scope.orgId || null);
}

async function loadScopedUser(id: string, scope: Scope): Promise<User> {
  const target = await userRepository.findById(id);
  if (!target) throw new AppError("User not found", 404);
  const callerOrgId = effectiveOrgId(scope);
  if (callerOrgId && target.orgId !== callerOrgId) {
    throw new AppError("User not found", 404);
  }
  return target;
}

export const userService = {
  async listUsers(scope?: Scope): Promise<User[]> {
    return userRepository.findAll(scope);
  },

  async getUserById(id: string, scope: Scope): Promise<User> {
    return loadScopedUser(id, scope);
  },

  async createUser(userData: InsertUser, scope: Scope): Promise<User> {
    const callerOrgId = effectiveOrgId(scope);
    const data: InsertUser = callerOrgId
      ? { ...userData, orgId: callerOrgId }
      : userData;
    return userRepository.create(data);
  },

  async updateUser(id: string, data: Partial<InsertUser>, scope: Scope): Promise<User> {
    await loadScopedUser(id, scope);
    const callerOrgId = effectiveOrgId(scope);
    const safeData = callerOrgId ? { ...data, orgId: callerOrgId } : data;
    const user = await userRepository.update(id, safeData);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  async deleteUser(id: string, scope: Scope): Promise<void> {
    await loadScopedUser(id, scope);
    await userRepository.remove(id);
  },
};
