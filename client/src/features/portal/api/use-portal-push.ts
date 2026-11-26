import { useCallback, useEffect, useState } from "react";
import { getPortalToken } from "@/hooks/use-portal-api";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

export type PortalPushState = "unknown" | "unsupported" | "off" | "on" | "denied";

const SERVICE_WORKER = "/portal-sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function doSubscribe(): Promise<boolean> {
  try {
    const token = getPortalToken();
    if (!token) return false;

    const reg = await navigator.serviceWorker.register(SERVICE_WORKER);
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const resp = await fetch(PORTAL_ENDPOINTS.pushVapidKey);
    const { publicKey } = await resp.json();
    if (!publicKey) return false;

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await fetch(PORTAL_ENDPOINTS.pushSubscribe, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return true;
  } catch (err) {
    console.warn("Push subscription failed:", err);
    return false;
  }
}

/** Unsubscribes this device (also used on sign-out). Never throws. */
export async function unsubscribePortalPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SERVICE_WORKER);
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const token = getPortalToken();
        if (token) {
          await fetch(PORTAL_ENDPOINTS.pushUnsubscribe, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
        }
        await sub.unsubscribe().catch(() => {});
      }
    }
  } catch {
    // Best effort.
  }
}

async function checkExistingSubscription(): Promise<boolean> {
  try {
    if (!pushSupported()) return false;
    if (Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration(SERVICE_WORKER);
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** This device's push-notification state for the signed-in customer, with enable/disable/toggle. */
export function usePortalPush() {
  const [state, setState] = useState<PortalPushState>("unknown");

  useEffect(() => {
    if (!getPortalToken()) return;
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    let cancelled = false;
    checkExistingSubscription().then((active) => {
      if (!cancelled) setState(active ? "on" : "off");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    const ok = await doSubscribe();
    setState(ok ? "on" : Notification.permission === "denied" ? "denied" : "off");
    return ok;
  }, []);

  const disable = useCallback(async () => {
    await unsubscribePortalPush();
    setState("off");
  }, []);

  const toggle = useCallback(async () => {
    if (state === "on") await disable();
    else await enable();
  }, [state, enable, disable]);

  return { state, enable, disable, toggle };
}
