import { useMutation, useQueryClient } from "@tanstack/react-query";
import { walletApi } from "@/api/endpoints/wallet.api";
import { walletKeys } from "@/hooks/queries/use-wallet-queries";

export function useProcessWalletDebit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { notes?: string } }) =>
      walletApi.processDebit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

export function useRejectWalletDebit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      walletApi.rejectDebit(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}
