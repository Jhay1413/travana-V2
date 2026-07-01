import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { bookingApi } from "@/api";
import { bookingKeys, dashboardKeys, bookingUpsellKeys } from "@/hooks/queries";
import { upsellToPayload } from "@/features/booking/types";
import type { UpsellPayload, UpsellItemValue } from "@/features/booking/types";
import { organizationOverviewKeys } from "@/features/organization/api/use-organization-overview-queries";
import { branchOverviewKeys } from "@/features/organization/api/use-branch-overview-queries";

// Upsell commission is recognised by `added_at`, so any create/edit/delete can
// shift a month's profit — invalidate the upsell list, the parent booking
// detail, the dashboard, and the org/branch overview stats (their trend feeds
// the Commission vs Target tab).
function invalidateUpsellRelated(queryClient: QueryClient, bookingId?: string) {
  queryClient.invalidateQueries({ queryKey: bookingUpsellKeys.all });
  queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  queryClient.invalidateQueries({ queryKey: organizationOverviewKeys.all });
  queryClient.invalidateQueries({ queryKey: branchOverviewKeys.all });
  if (bookingId) {
    queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
  }
}

export function useCreateUpsell() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, body }: { bookingId: string; body: UpsellPayload }) =>
      bookingApi.createUpsell(bookingId, body),
    onSuccess: (_data, { bookingId }) => invalidateUpsellRelated(queryClient, bookingId),
  });
}

export function useUpdateUpsell() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ upsellId, body }: { upsellId: string; body: Partial<UpsellPayload>; bookingId?: string }) =>
      bookingApi.updateUpsell(upsellId, body),
    onSuccess: (_data, { bookingId }) => invalidateUpsellRelated(queryClient, bookingId),
  });
}

export function useRemoveUpsell() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ upsellId }: { upsellId: string; bookingId?: string }) =>
      bookingApi.removeUpsell(upsellId),
    onSuccess: (_data, { bookingId }) => invalidateUpsellRelated(queryClient, bookingId),
  });
}

/**
 * Persists a booking's upsells via the dedicated upsell endpoints by diffing the
 * form rows against what's currently saved: new rows (no `id`) are created,
 * existing rows are PATCHed in place (keeping `added_at` immutable), and rows the
 * user removed are soft-deleted. Shared by the in-form Upsells section and the
 * standalone Manage Upsells dialog so both persist identically — the booking
 * PATCH itself ignores the `upsells` key.
 */
export function useReconcileUpsells() {
  const createUpsell = useCreateUpsell();
  const updateUpsell = useUpdateUpsell();
  const removeUpsell = useRemoveUpsell();

  async function reconcile(
    bookingId: string,
    rows: UpsellItemValue[],
    existing: { id: string }[],
  ): Promise<void> {
    const keptIds = new Set(rows.map((r) => r.id).filter(Boolean) as string[]);
    const toRemove = existing.filter((e) => !keptIds.has(e.id));

    await Promise.all([
      ...rows.map((row) =>
        row.id
          ? updateUpsell.mutateAsync({ upsellId: row.id, body: upsellToPayload(row), bookingId })
          : createUpsell.mutateAsync({ bookingId, body: upsellToPayload(row) })
      ),
      ...toRemove.map((u) => removeUpsell.mutateAsync({ upsellId: u.id, bookingId })),
    ]);
  }

  return {
    reconcile,
    isPending: createUpsell.isPending || updateUpsell.isPending || removeUpsell.isPending,
  };
}
