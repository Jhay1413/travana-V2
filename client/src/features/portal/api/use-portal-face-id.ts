import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalApiError, clearLocalBiometric, getPortalToken, hasLocalBiometric, portalFetch, registerPortalBiometric } from "@/hooks/use-portal-api";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

/** The server's code for "set-up needs a PIN sign-in from the last 10 minutes". */
export const REAUTH_REQUIRED_CODE = "REAUTH_REQUIRED";

export const FACE_ID_REAUTH_MESSAGE = "Sign in with your PIN again to set this up.";

const LOCAL_CREDENTIAL_KEY = "portal_credential_id";

/** One Face ID set-up on the customer's account (newest first). */
export interface FaceIdDevice {
  id: string;
  credentialId: string;
  createdAt: string | null;
}

export const faceIdKeys = { devices: ["portal", "webauthn-credentials"] as const };

export type FaceIdSetupResult =
  | { status: "done" }
  | { status: "reauth" }
  | { status: "unavailable" }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

/** Turns whatever set-up threw into a result the Account page can show. Exported for tests. */
export function interpretFaceIdError(err: unknown): FaceIdSetupResult {
  if (err instanceof PortalApiError && err.code === REAUTH_REQUIRED_CODE) return { status: "reauth" };
  if (typeof DOMException !== "undefined" && err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) {
    return { status: "cancelled" };
  }
  return { status: "failed", message: err instanceof Error && err.message ? err.message : "We couldn't set up Face ID. Please try again." };
}

/** The server row for this device (matched on the credential id the device remembered), or undefined. */
export function findThisDevice(devices: readonly FaceIdDevice[], localCredentialId: string | null): FaceIdDevice | undefined {
  if (!localCredentialId) return undefined;
  return devices.find((d) => d.credentialId === localCredentialId);
}

/**
 * Is Face ID set up on THIS device? The device's own memory (a credential id) says it was; the account's device
 * list, once loaded, says whether that credential still exists (it is gone if it was removed from another device).
 */
export function faceIdEnabledOnThisDevice(localCredentialId: string | null, devices: readonly FaceIdDevice[] | undefined): boolean {
  if (!localCredentialId) return false;
  if (!devices) return true;
  return devices.some((d) => d.credentialId === localCredentialId);
}

/** Face ID / fingerprint set-up and removal for this customer. Removal deletes the credential on the server. */
export function usePortalFaceId() {
  const queryClient = useQueryClient();
  const [localEnabled, setLocalEnabled] = useState(() => hasLocalBiometric());
  const [pending, setPending] = useState(false);

  const devicesQuery = useQuery<FaceIdDevice[]>({
    queryKey: faceIdKeys.devices,
    queryFn: () => portalFetch(PORTAL_ENDPOINTS.webauthnCredentials),
    retry: false,
    enabled: !!getPortalToken(),
  });
  const devices = devicesQuery.data ?? [];
  const loaded = devicesQuery.isSuccess && !devicesQuery.isFetching;
  const enabled = localEnabled && faceIdEnabledOnThisDevice(localStorage.getItem(LOCAL_CREDENTIAL_KEY), loaded ? devicesQuery.data : undefined);

  // A set-up removed from another device is gone from the account: forget it here too, so the sign-in screen stops offering it.
  useEffect(() => {
    if (loaded && localEnabled && !faceIdEnabledOnThisDevice(localStorage.getItem(LOCAL_CREDENTIAL_KEY), devicesQuery.data)) {
      clearLocalBiometric();
      setLocalEnabled(false);
    }
  }, [loaded, localEnabled, devicesQuery.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: faceIdKeys.devices });

  const setUp = useCallback(async (): Promise<FaceIdSetupResult> => {
    setPending(true);
    try {
      await registerPortalBiometric();
      // registerPortalBiometric resolves quietly when the device has no platform authenticator; success sets the local flag.
      const ok = hasLocalBiometric();
      setLocalEnabled(ok);
      if (ok) await queryClient.invalidateQueries({ queryKey: faceIdKeys.devices });
      return ok ? { status: "done" } : { status: "unavailable" };
    } catch (err) {
      return interpretFaceIdError(err);
    } finally {
      setPending(false);
    }
  }, [queryClient]);

  /** Deletes one set-up on the server. Throws if the server refuses, so nothing is forgotten locally by mistake. */
  const removeDevice = useCallback(
    async (id: string) => {
      await portalFetch(PORTAL_ENDPOINTS.webauthnCredential(id), { method: "DELETE" });
      const mine = findThisDevice(devices, localStorage.getItem(LOCAL_CREDENTIAL_KEY));
      if (mine?.id === id) {
        clearLocalBiometric();
        setLocalEnabled(false);
      }
      await refresh();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices],
  );

  /** Removes THIS device's Face ID: the server's credential first, then the local memory of it. */
  const remove = useCallback(async () => {
    const fresh = await queryClient.fetchQuery<FaceIdDevice[]>({
      queryKey: faceIdKeys.devices,
      queryFn: () => portalFetch(PORTAL_ENDPOINTS.webauthnCredentials),
      staleTime: 0,
    });
    const mine = findThisDevice(fresh, localStorage.getItem(LOCAL_CREDENTIAL_KEY));
    if (mine) await portalFetch(PORTAL_ENDPOINTS.webauthnCredential(mine.id), { method: "DELETE" });
    clearLocalBiometric();
    setLocalEnabled(false);
    await queryClient.invalidateQueries({ queryKey: faceIdKeys.devices });
  }, [queryClient]);

  return { enabled, pending, setUp, remove, removeDevice, devices, thisDeviceId: findThisDevice(devices, localStorage.getItem(LOCAL_CREDENTIAL_KEY))?.id ?? null };
}
