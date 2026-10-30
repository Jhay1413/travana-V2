import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientPassengerApi, type LeadPassportInput, type PassengerInput } from "./client-passenger.api";

export const clientPassengerKeys = {
  all: ["client-passengers"] as const,
  list: (clientId: string) => ["client-passengers", clientId] as const,
};

export function useClientPassengers(clientId: string) {
  return useQuery({
    queryKey: clientPassengerKeys.list(clientId),
    queryFn: () => clientPassengerApi.list(clientId),
    enabled: !!clientId,
    // Next departure and the passport warning depend on bookings, so always refetch.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Add / edit / delete mutations for one client's passengers; each refreshes the list. */
export function useClientPassengerMutations(clientId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: clientPassengerKeys.list(clientId) });

  const saveLead = useMutation({
    mutationFn: (input: LeadPassportInput) => clientPassengerApi.saveLead(clientId, input),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: (input: PassengerInput) => clientPassengerApi.create(clientId, input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ passengerId, input }: { passengerId: string; input: Partial<PassengerInput> }) =>
      clientPassengerApi.update(clientId, passengerId, input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (passengerId: string) => clientPassengerApi.remove(clientId, passengerId),
    onSuccess: refresh,
  });

  return { saveLead, create, update, remove };
}
