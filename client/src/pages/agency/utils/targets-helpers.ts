import type { Branch, BranchType } from "@/features/organization/api/branch.api";

type PickerBranch = Pick<Branch, "id" | "isActive" | "isDefault">;

/** Homeworker branches carry agent targets only; the shop-target editor is hidden for them. */
export function hidesShopTargets(type: BranchType): boolean {
  return type === "homeworker";
}

/** Which list the selected id belongs to (shop wins if somehow in both). */
export function branchTypeOf(id: string | null, shop: readonly PickerBranch[], homeworkers: readonly PickerBranch[]): BranchType {
  if (id && !shop.some((b) => b.id === id) && homeworkers.some((b) => b.id === id)) return "homeworker";
  return "shop";
}

/** Default pick: the default shop branch, else the first shop branch, else the first homeworker. */
export function defaultTargetBranch(shop: readonly PickerBranch[], homeworkers: readonly PickerBranch[]): string | null {
  const activeShop = shop.filter((b) => b.isActive);
  const preferred = activeShop.find((b) => b.isDefault) ?? activeShop[0];
  if (preferred) return preferred.id;
  return homeworkers.find((b) => b.isActive)?.id ?? null;
}

/** "No branches" only when both lists are empty of active entries. */
export function hasNoTargetBranches(shop: readonly PickerBranch[], homeworkers: readonly PickerBranch[]): boolean {
  return !shop.some((b) => b.isActive) && !homeworkers.some((b) => b.isActive);
}
