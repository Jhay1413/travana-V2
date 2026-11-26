import { useMutation, useQuery, useQueryClient, type MutationOptions, type QueryClient } from "@tanstack/react-query";
import type { PortalPassenger, PortalPassportInput, PortalPassportReadResult } from "@shared/portal-passengers";
import { clearPortalToken, getPortalToken, portalFetch, PortalApiError } from "@/hooks/use-portal-api";
import { downscalePassportPhoto } from "../lib/passport-image";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

export const portalPassengerKeys = {
  list: ["portal", "passengers"] as const,
};

const UPLOAD_FAILED = "We couldn't send that photo. Check your connection and try again, or type the details in.";

/** The signed-in customer's passengers (the customer first), each with a masked passport and a plain-words check. */
export function usePortalPassengers() {
  return useQuery<PortalPassenger[], PortalApiError>({
    queryKey: portalPassengerKeys.list,
    queryFn: () => portalFetch(PORTAL_ENDPOINTS.passengers),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

/**
 * Sends a passport photo to be read. Nothing is saved: the answer fills the review form. The photo is shrunk in the
 * browser first. Fails with a PortalApiError whose message is safe to show (422 = could not read it, 503 = reading
 * is unavailable, 429 = too many reads).
 */
export async function readPassportPhoto(file: File): Promise<PortalPassportReadResult> {
  const photo = await downscalePassportPhoto(file);
  const body = new FormData();
  body.append("photo", photo, "passport.jpg");

  let res: Response;
  try {
    // No Content-Type header: the browser sets the multipart boundary itself.
    res = await fetch(PORTAL_ENDPOINTS.passportRead, { method: "POST", headers: { Authorization: `Bearer ${getPortalToken() ?? ""}` }, body });
  } catch {
    throw new PortalApiError(UPLOAD_FAILED, 0);
  }
  if (res.status === 401) {
    clearPortalToken();
    window.location.href = "/portal/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const failure = (await res.json().catch(() => ({}))) as { error?: unknown; code?: unknown };
    throw new PortalApiError(
      typeof failure.error === "string" && failure.error ? failure.error : UPLOAD_FAILED,
      res.status,
      typeof failure.code === "string" ? failure.code : undefined,
    );
  }
  return (await res.json()) as PortalPassportReadResult;
}

// The save variables hold the FULL passport number. The mutation cache must never keep them: `gcTime: 0` drops a
// mutation as soon as nothing observes it, and the hooks below reset their observer the moment a call settles, so
// the variables are gone as soon as the call ends. (Do not call readPassportPhoto through a mutation either: its
// result would enter the cache; it is a plain async function on purpose.)

export interface SavePassportVariables {
  id: string;
  input: PortalPassportInput;
}

export function savePassportMutationOptions(queryClient: QueryClient): MutationOptions<PortalPassenger, PortalApiError, SavePassportVariables> {
  return {
    mutationFn: ({ id, input }) => portalFetch(PORTAL_ENDPOINTS.passengerPassport(id), { method: "PUT", body: JSON.stringify(input) }),
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalPassengerKeys.list }),
  };
}

export function createPassengerMutationOptions(queryClient: QueryClient): MutationOptions<PortalPassenger, PortalApiError, PortalPassportInput> {
  return {
    mutationFn: (input) => portalFetch(PORTAL_ENDPOINTS.passengers, { method: "POST", body: JSON.stringify(input) }),
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalPassengerKeys.list }),
  };
}

/** `id` is a passenger id, or "lead" for the customer's own passport before a lead row exists. Failures throw a PortalApiError. */
export function useSavePortalPassport() {
  const queryClient = useQueryClient();
  const { mutateAsync, reset, isPending } = useMutation(savePassportMutationOptions(queryClient));
  return {
    isPending,
    reset,
    mutateAsync: async (variables: SavePassportVariables): Promise<PortalPassenger> => {
      try {
        return await mutateAsync(variables);
      } finally {
        reset();
      }
    },
  };
}

/** Adds another traveller (never the lead: the customer is already listed). Failures throw a PortalApiError. */
export function useCreatePortalPassenger() {
  const queryClient = useQueryClient();
  const { mutateAsync, reset, isPending } = useMutation(createPassengerMutationOptions(queryClient));
  return {
    isPending,
    reset,
    mutateAsync: async (input: PortalPassportInput): Promise<PortalPassenger> => {
      try {
        return await mutateAsync(input);
      } finally {
        reset();
      }
    },
  };
}
