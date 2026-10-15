/**
 * Centralized API path constants.
 *
 * Feature API modules (`features/<feature>/api/`) should build their request
 * URLs from these constants instead of hardcoding path strings. This file is
 * populated incrementally as features are migrated to the feature-based
 * structure — start with the shared base prefix.
 */
export const API_V2 = "/api/v2";

export const BRANCH_ENDPOINTS = {
  base: `${API_V2}/branches`,
  byId: (id: string) => `${API_V2}/branches/${id}`,
} as const;

export const HOMEWORKER_ENDPOINTS = {
  base: `${API_V2}/homeworkers`,
  me: `${API_V2}/homeworkers/me`,
  meStatement: `${API_V2}/homeworkers/me/statement`,
  statement: (branchId: string) => `${API_V2}/homeworkers/${branchId}/statement`,
  finalise: (branchId: string) => `${API_V2}/homeworkers/${branchId}/statement/finalise`,
  byId: (branchId: string) => `${API_V2}/homeworkers/${branchId}`,
  archive: (branchId: string) => `${API_V2}/homeworkers/${branchId}/archive`,
} as const;
