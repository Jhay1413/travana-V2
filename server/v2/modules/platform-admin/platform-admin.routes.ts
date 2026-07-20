import { Router } from 'express';
import { platformAdminController } from './platform-admin.controller';
import { isAuthenticated, requirePlatformAdmin } from '../../middlewares/auth';
import { validate } from '../../middlewares/validation.middleware';
import {
  orgIdParamSchema,
  suspendOrgSchema,
  activateOrgSchema,
  changePlanSchema,
  auditLogQuerySchema,
  listUsersQuerySchema,
  userIdParamSchema,
  changeUserRoleSchema,
  deactivateUserSchema,
  updateCreditLimitSchema,
  updateOveragePriceSchema,
  topUpCreditsSchema,
  usageHistoryQuerySchema,
  listChargesQuerySchema,
  writeOffChargeSchema,
  orgUserIdParamsSchema,
  addUserRoleBodySchema,
  removeUserRoleParamsSchema,
  usageHistoryMonthsQuerySchema,
  updateUsageLimitsSchema,
  usageOverviewQuerySchema,
  upsertModelPricingSchema,
} from './platform-admin.validator';

const router = Router();

// Router-level guards: every endpoint in this module requires authentication
// AND a verified platform_admin role (DB-backed; never trusts req.orgRole).
router.use(isAuthenticated);
router.use(requirePlatformAdmin);

// Organizations
router.get(   '/organizations',                requirePlatformAdmin,                                          platformAdminController.listOrgs);
router.get(   '/organizations/:id',            requirePlatformAdmin, validate(orgIdParamSchema),              platformAdminController.getOrg);
router.patch( '/organizations/:id/suspend',    requirePlatformAdmin, validate(suspendOrgSchema),              platformAdminController.suspend);
router.patch( '/organizations/:id/activate',   requirePlatformAdmin, validate(activateOrgSchema),             platformAdminController.activate);
router.patch( '/organizations/:id/plan',       requirePlatformAdmin, validate(changePlanSchema),              platformAdminController.changePlan);

// Cross-org user directory
router.get(   '/users',                        requirePlatformAdmin, validate(listUsersQuerySchema),          platformAdminController.listUsers);
router.get(   '/users/:id',                    requirePlatformAdmin, validate(userIdParamSchema),             platformAdminController.getUser);

// Org-scoped users (recovery actions)
router.get(   '/organizations/:id/users',                requirePlatformAdmin, validate(orgIdParamSchema),     platformAdminController.listOrgUsers);
router.patch( '/organizations/:id/users/:userId/role',   requirePlatformAdmin, validate(changeUserRoleSchema), platformAdminController.changeUserRole);
router.patch( '/organizations/:id/users/:userId/deactivate', requirePlatformAdmin, validate(deactivateUserSchema), platformAdminController.deactivateUser);
router.patch( '/organizations/:id/users/:userId/reactivate', requirePlatformAdmin, validate(deactivateUserSchema), platformAdminController.reactivateUser);

// Multi-role: full role-set management per user (used by the chip editor).
router.get(   '/organizations/:id/users/:userId/roles',         requirePlatformAdmin, validate(orgUserIdParamsSchema),      platformAdminController.listUserRoles);
router.post(  '/organizations/:id/users/:userId/roles',         requirePlatformAdmin, validate(addUserRoleBodySchema),      platformAdminController.addUserRoleMulti);
router.delete('/organizations/:id/users/:userId/roles/:role',   requirePlatformAdmin, validate(removeUserRoleParamsSchema), platformAdminController.removeUserRoleMulti);

// Org-scoped branches (read-only — admin uses impersonation for writes)
router.get(   '/organizations/:id/branches',   requirePlatformAdmin, validate(orgIdParamSchema),              platformAdminController.listOrgBranches);

// Impersonation
router.post(  '/organizations/:id/impersonate', requirePlatformAdmin, validate(orgIdParamSchema),             platformAdminController.impersonate);
router.delete('/impersonate',                   requirePlatformAdmin,                                          platformAdminController.stopImpersonating);

// SMS credits (per-org configuration + usage + overage billing)
router.get(   '/organizations/:id/credits',                          requirePlatformAdmin, validate(orgIdParamSchema),            platformAdminController.getCreditSummary);
router.patch( '/organizations/:id/credits/limit',                    requirePlatformAdmin, validate(updateCreditLimitSchema),     platformAdminController.updateCreditLimit);
router.patch( '/organizations/:id/credits/price',                    requirePlatformAdmin, validate(updateOveragePriceSchema),    platformAdminController.updateOveragePrice);
router.post(  '/organizations/:id/credits/topup',                    requirePlatformAdmin, validate(topUpCreditsSchema),          platformAdminController.topUpCredits);
router.get(   '/organizations/:id/credits/usage',                    requirePlatformAdmin, validate(usageHistoryQuerySchema),     platformAdminController.getUsageHistory);
router.get(   '/organizations/:id/credits/charges',                  requirePlatformAdmin, validate(listChargesQuerySchema),      platformAdminController.listCharges);
router.patch( '/organizations/:id/credits/charges/:chargeId/write-off', requirePlatformAdmin, validate(writeOffChargeSchema),     platformAdminController.writeOffCharge);

// AI + SendSeven usage limits & metering (monitoring + config; see docs/ai-usage-limits-plan.md)
router.get(   '/organizations/:id/usage',            requirePlatformAdmin, validate(orgIdParamSchema),            platformAdminController.getOrgUsage);
router.get(   '/organizations/:id/usage/history',     requirePlatformAdmin, validate(usageHistoryMonthsQuerySchema), platformAdminController.getOrgUsageHistory);
router.patch( '/organizations/:id/usage-limits',      requirePlatformAdmin, validate(updateUsageLimitsSchema),     platformAdminController.updateUsageLimits);
router.get(   '/usage/overview',                      requirePlatformAdmin, validate(usageOverviewQuerySchema),    platformAdminController.getUsageOverview);
router.get(   '/model-pricing',                       requirePlatformAdmin,                                          platformAdminController.listModelPricing);
router.put(   '/model-pricing/:model',                requirePlatformAdmin, validate(upsertModelPricingSchema),    platformAdminController.upsertModelPricing);

// Audit log
router.get(   '/audit-log',                    requirePlatformAdmin, validate(auditLogQuerySchema),           platformAdminController.listAudit);

export default router;
