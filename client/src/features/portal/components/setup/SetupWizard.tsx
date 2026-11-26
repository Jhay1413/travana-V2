import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { getPortalToken } from "@/hooks/use-portal-api";
import {
  OPEN_SETUP_WIZARD_EVENT,
  WIZARD_KEY,
  clearInstallPrompt,
  detectPlatform,
  errorReason,
  getInstallPrompt,
  isStandalone,
  pushSupported,
  shouldAutoOpen,
  watchInstallPrompt,
  wizardOutcome,
  type NotifStatus,
  type Platform,
} from "../../lib/setup-wizard";
import { toRoman } from "../../lib/quote-format";
import { PortalButton } from "../brand";
import { PortalSheet } from "../PortalSheet";

/**
 * The install-app / notifications wizard, as a themed sheet. It opens by itself once per device on Home (unless the
 * app is already installed), and the Account page reopens it with OPEN_SETUP_WIZARD_EVENT. `manualOnly` means it
 * never opens by itself, only on that event.
 */
export function SetupWizard({ manualOnly = false }: { manualOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [platform] = useState<Platform>(detectPlatform);
  const [standalone] = useState(isStandalone);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(() => !!getInstallPrompt());
  const [installed, setInstalled] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotifStatus>("idle");
  const [notifError, setNotifError] = useState("");
  const hasPush = pushSupported();
  const [showInstallTip, setShowInstallTip] = useState(platform === "ios" && !hasPush);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SETUP_WIZARD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETUP_WIZARD_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!shouldAutoOpen({ manualOnly, signedIn: !!getPortalToken(), alreadyDone: !!localStorage.getItem(WIZARD_KEY), standalone: isStandalone() })) return;

    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [manualOnly]);

  // The browser can hand over its install prompt late, whichever way the wizard was opened (by itself or from Account).
  useEffect(() => {
    if (installPromptAvailable || standalone) return;
    return watchInstallPrompt(() => setInstallPromptAvailable(true));
  }, [installPromptAvailable, standalone]);

  const finish = () => {
    localStorage.setItem(WIZARD_KEY, "1");
    setOpen(false);
  };

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    try {
      void prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") {
        setInstalled(true);
        clearInstallPrompt();
        setInstallPromptAvailable(false);
      }
    } catch {
      // The customer can still follow the "How to install" steps.
    }
  };

  const handleEnableNotifications = async () => {
    setNotifStatus("loading");
    setNotifError("");
    try {
      const reg = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifError(perm === "denied" ? "Blocked — open your browser settings and allow notifications for this site, then try again." : "Permission not granted — please tap 'Allow' when prompted.");
        setNotifStatus("error");
        return;
      }

      const vapidRes = await fetch("/api/portal/push/vapid-key");
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) {
        setNotifError("Server config error");
        setNotifStatus("error");
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      }

      const token = getPortalToken();
      const saveRes = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!saveRes.ok) throw new Error(`Failed: ${saveRes.status}`);

      setNotifStatus("done");
    } catch (err) {
      setNotifError(errorReason(err));
      setNotifStatus("error");
    }
  };

  const outcome = wizardOutcome({ notifStatus, installed, standalone, platform });

  return (
    <PortalSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
      }}
      label="Welcome"
      lead="Get set up"
      italic="in seconds."
      testId="setup-wizard"
    >
      {outcome === "all-done" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status" data-testid="wizard-all-done">
          <Check className="size-8 portal-text-amber-ink" strokeWidth={1.5} aria-hidden />
          <p className="portal-serif text-[30px] leading-tight text-primary">You&apos;re all set.</p>
          <p className="max-w-[300px] text-[15px] text-muted-foreground">You&apos;ll get notified when your travel agent messages you.</p>
          <PortalButton size="lg" className="mt-4 w-full" onClick={finish} data-testid="wizard-finish">
            Let&apos;s go
          </PortalButton>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="border-b border-border pb-8">
            <WizardHeading title="Message notifications" note="Know instantly when your agent replies" done={notifStatus === "done"} />
            {notifStatus === "done" ? (
              <p className="mt-3 text-[15px] portal-text-amber-ink" data-testid="wizard-notif-done">
                Notifications enabled — you&apos;re all set!
              </p>
            ) : hasPush ? (
              <div className="mt-4 flex flex-col gap-3">
                {notifError && (
                  <p role="alert" className="portal-text-danger border border-current px-3 py-2.5 text-[15px] [overflow-wrap:anywhere]" data-testid="wizard-notif-error">
                    {notifError}
                  </p>
                )}
                <PortalButton size="lg" className="w-full" onClick={handleEnableNotifications} disabled={notifStatus === "loading"} data-testid="wizard-enable-push">
                  {notifStatus === "loading" ? "Setting up…" : notifStatus === "error" ? "Try again" : "Turn on notifications"}
                </PortalButton>
                <p className="text-center text-[14px] text-muted-foreground">Tap &quot;Allow&quot; when your browser asks. You can turn this off anytime.</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2 border border-border bg-secondary px-4 py-3" data-testid="wizard-notif-unavailable">
                {platform === "ios" ? (
                  <>
                    <p className="text-[15px] font-normal text-foreground">On iPhone, Apple requires you to install this app first.</p>
                    <p className="text-[15px] text-muted-foreground">
                      Use the &quot;Add to Home Screen&quot; option below, then open the app from your Home Screen. Notifications will work after that.
                    </p>
                  </>
                ) : (
                  <p className="text-[15px] text-foreground">Notifications aren&apos;t available in this browser. Try opening this page directly in Chrome or Safari.</p>
                )}
              </div>
            )}
          </div>

          {!standalone && platform !== "desktop" && (
            <div className="border-b border-border pb-8" data-testid="wizard-install">
              <WizardHeading title="Add to Home Screen" note="Open like a real app, with no browser bars" done={installed} />
              {installed ? (
                <p className="mt-3 text-[15px] portal-text-amber-ink">Installed! Find it on your Home Screen.</p>
              ) : installPromptAvailable ? (
                <PortalButton size="lg" className="mt-4 w-full" onClick={handleInstall} data-testid="wizard-install-app">
                  Install app
                </PortalButton>
              ) : (
                <>
                  <PortalButton
                    variant="outline"
                    className="mt-4 w-full"
                    aria-expanded={showInstallTip}
                    aria-controls="wizard-install-steps"
                    onClick={() => setShowInstallTip(!showInstallTip)}
                    data-testid="wizard-show-install-steps"
                  >
                    How to install
                  </PortalButton>
                  {showInstallTip && (
                    <div id="wizard-install-steps" className="mt-4" data-testid="wizard-install-steps">
                      {platform === "ios" ? (
                        <>
                          <p className="portal-eyebrow mb-2">Use Safari for this step</p>
                          <Steps>
                            <>Tap the Share button at the bottom of the screen</>
                            <>
                              Tap the Plus button (bottom right), then <strong className="font-normal text-primary">&quot;Add to Home Screen&quot;</strong>
                            </>
                            <>
                              Tap <strong className="font-normal text-primary">&quot;Add&quot;</strong> and open it from your Home Screen
                            </>
                          </Steps>
                        </>
                      ) : (
                        <Steps>
                          <>
                            Tap <strong className="font-normal text-primary">⋮ Menu</strong> (top right)
                          </>
                          <>
                            Tap <strong className="font-normal text-primary">&quot;Install app&quot;</strong> or{" "}
                            <strong className="font-normal text-primary">&quot;Add to Home screen&quot;</strong>
                          </>
                          <>
                            Tap <strong className="font-normal text-primary">&quot;Install&quot;</strong>
                          </>
                        </Steps>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {outcome === "notifications-only" && (
              <PortalButton size="lg" className="w-full" onClick={finish} data-testid="wizard-continue">
                Continue
              </PortalButton>
            )}
            <PortalButton variant="link" className="self-center" onClick={finish} data-testid="wizard-skip">
              {notifStatus === "done" ? "Done" : "Maybe later"}
            </PortalButton>
          </div>
        </div>
      )}
    </PortalSheet>
  );
}

function WizardHeading({ title, note, done }: { title: string; note: string; done: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="portal-serif text-[24px] leading-tight text-primary">{title}</h3>
        <p className="text-[15px] text-muted-foreground">{note}</p>
      </div>
      {done && <Check className="mt-1 size-5 flex-none portal-text-amber-ink" strokeWidth={1.75} aria-label="Done" />}
    </div>
  );
}

function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className="border-b border-border">
      {children.map((step, i) => (
        <li key={i} className="flex gap-4 border-t border-border py-3">
          <span className="portal-serif w-7 flex-none text-[20px] leading-tight portal-text-amber-ink" aria-hidden>
            {toRoman(i + 1)}
          </span>
          <span className="min-w-0 text-[15px] leading-relaxed text-foreground">{step}</span>
        </li>
      ))}
    </ol>
  );
}
