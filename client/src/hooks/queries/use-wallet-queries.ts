import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/api/endpoints/wallet.api";

export const walletKeys = {
  all: ["wallet-transactions"] as const,
  lists: () => [...walletKeys.all, "list"] as const,
};

export function useAllWalletTransactions() {
  return useQuery({
    queryKey: walletKeys.lists(),
    queryFn: () => walletApi.listAll(),
  });
}
