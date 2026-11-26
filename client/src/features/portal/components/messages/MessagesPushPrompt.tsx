import { useEffect, useState } from "react";
import { getPortalToken } from "@/hooks/use-portal-api";
import { PortalButton } from "../brand";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Whether this browser can do web push at all. */
export function pushAvailable(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function reason(error: unknown, fallback = "unknown"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

type Status = "idle" | "loading" | "error" | "unsupported";

/**
 * The strip above the chat that offers push notifications for agent replies, shown until the customer has them
 * on (or dismisses it). The steps and the wording of the errors are the ones this screen has always used.
 */
export function MessagesPushPrompt({ onEnabled }: { onEnabled: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const missing: string[] = [];
    if (!("serviceWorker" in navigator)) missing.push("ServiceWorker");
    if (!("PushManager" in window)) missing.push("PushManager");
    if (!("Notification" in window)) missing.push("Notification");
    if (missing.length > 0) {
      setStatus("unsupported");
      const inIframe = window.self !== window.top;
      const ua = navigator.userAgent || "";
      const isIOS = /iPhone|iPad|iPod/.test(ua);
      if (inIframe) {
        setErrorMsg("Open this site directly in your browser to enable notifications.");
      } else if (isIOS) {
        setErrorMsg("On iPhone, Apple requires you to install this app first. Tap Share → Add to Home Screen in Safari, then open the app from your Home Screen.");
      } else {
        setErrorMsg(`Push not supported. Browser: ${ua.slice(0, 80)}`);
      }
    } else if (Notification.permission === "denied") {
      setStatus("error");
      setErrorMsg("Notifications blocked. Go to your browser settings for this site and allow notifications.");
    }
  }, []);

  const handleEnable = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const token = getPortalToken();
      if (!token) {
        setStatus("error");
        setErrorMsg("Not logged in");
        return;
      }

      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.register("/portal-sw.js");
        await navigator.serviceWorker.ready;
      } catch (e) {
        setStatus("error");
        setErrorMsg(`Service worker failed: ${reason(e)}`);
        return;
      }

      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch (e) {
        setStatus("error");
        setErrorMsg(`Permission request failed: ${reason(e)}`);
        return;
      }
      if (permission !== "granted") {
        setStatus("error");
        setErrorMsg(permission === "denied" ? "Notifications blocked. Check your browser settings." : "Permission not granted — please tap 'Allow' when prompted.");
        return;
      }

      const resp = await fetch("/api/portal/push/vapid-key");
      const { publicKey } = (await resp.json()) as { publicKey?: string };
      if (!publicKey) {
        setStatus("error");
        setErrorMsg("Server config error — VAPID key missing");
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        } catch (e) {
          setStatus("error");
          setErrorMsg(`Push subscribe failed: ${reason(e)}`);
          return;
        }
      }

      const subResp = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!subResp.ok) {
        const errData = (await subResp.json().catch(() => ({}))) as { error?: string };
        setStatus("error");
        setErrorMsg(errData.error || "Subscription failed on server");
        return;
      }

      setStatus("idle");
      onEnabled();
    } catch (err) {
      console.error("Push enable error:", err);
      setStatus("error");
      setErrorMsg(reason(err, "Something went wrong"));
    }
  };

  if (dismissed) return null;

  return (
    <section aria-label="Notifications" className="border-b border-border bg-secondary px-7 py-3.5" data-testid="messages-push-prompt">
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
        <p className="portal-serif text-[20px] leading-tight text-primary">Hear back sooner</p>
        <p className="text-[15px] text-muted-foreground">Get notified instantly when your travel agent replies.</p>
        {errorMsg && (
          <p role="alert" className="portal-text-danger text-[14px] [overflow-wrap:anywhere]">
            {errorMsg}
          </p>
        )}
        <div className="flex items-center gap-4">
          {status !== "unsupported" && (
            <PortalButton variant="link" className="text-[11px]" onClick={handleEnable} disabled={status === "loading"} data-testid="button-enable-push-messages">
              {status === "loading" ? "Enabling…" : "Turn on notifications"}
            </PortalButton>
          )}
          <PortalButton variant="link" className="text-[11px] text-muted-foreground" onClick={() => setDismissed(true)} data-testid="button-dismiss-push-messages">
            Dismiss
          </PortalButton>
        </div>
      </div>
    </section>
  );
}
