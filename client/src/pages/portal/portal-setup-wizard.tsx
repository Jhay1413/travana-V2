import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Bell, CheckCircle2, ChevronRight, X,
  Download, Plus, Ellipsis, ArrowUpFromLine, ExternalLink,
} from "lucide-react";
import { getPortalToken } from "@/hooks/use-portal-api";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

const WIZARD_KEY = "portal_setup_wizard_done";

let deferredInstallPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
}

export default function PortalSetupWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [platform] = useState<Platform>(detectPlatform);
  const [standalone] = useState(isStandalone);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(!!deferredInstallPrompt);
  const [installed, setInstalled] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notifError, setNotifError] = useState("");

  useEffect(() => {
    const token = getPortalToken();
    if (!token) return;
    if (localStorage.getItem(WIZARD_KEY)) return;
    if (isStandalone()) return;

    const checkPrompt = setInterval(() => {
      if (deferredInstallPrompt) {
        setInstallPromptAvailable(true);
        clearInterval(checkPrompt);
      }
    }, 500);

    const t = setTimeout(() => setOpen(true), 800);
    return () => { clearTimeout(t); clearInterval(checkPrompt); };
  }, []);

  const finish = () => {
    localStorage.setItem(WIZARD_KEY, "1");
    setOpen(false);
  };

  const handleInstall = async () => {
    if (!deferredInstallPrompt) return;
    try {
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result.outcome === "accepted") {
        setInstalled(true);
        deferredInstallPrompt = null;
        setInstallPromptAvailable(false);
        setTimeout(() => setStep(1), 1200);
      }
    } catch {}
  };

  const handleEnableNotifications = async () => {
    setNotifStatus("loading");
    setNotifError("");
    try {
      const reg = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifError(perm === "denied" ? "Blocked — open browser settings and allow notifications for this site" : "Permission not granted — please tap 'Allow' when prompted");
        setNotifStatus("error");
        return;
      }

      const vapidRes = await fetch("/api/portal/push/vapid-key");
      const { publicKey } = await vapidRes.json();
      if (!publicKey) { setNotifError("Server config error"); setNotifStatus("error"); return; }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
      }

      const token = getPortalToken();
      const saveRes = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!saveRes.ok) throw new Error(`Failed: ${saveRes.status}`);

      setNotifStatus("done");
    } catch (err: any) {
      setNotifError(err?.message || "Something went wrong");
      setNotifStatus("error");
    }
  };

  const needsInstall = !standalone && platform !== "desktop";
  const steps = needsInstall
    ? [{ id: "install", title: "Install App" }, { id: "notify", title: "Notifications" }]
    : [{ id: "notify", title: "Notifications" }];

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={finish} />

        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-gradient-to-b from-[#1a1030] to-[#0f0a1e] border border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
          data-testid="setup-wizard"
        >
          <button
            onClick={finish}
            className="absolute top-4 right-4 z-10 text-white/40 hover:text-white/70 p-1"
            data-testid="wizard-close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="px-6 pt-8 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-white text-lg font-bold">Quick Setup</h2>
            </div>
            <p className="text-white/50 text-sm mt-1">Get the best experience in just {steps.length} step{steps.length > 1 ? "s" : ""}</p>

            {steps.length > 1 && (
              <div className="flex gap-2 mt-4">
                {steps.map((s, i) => (
                  <div key={s.id} className="flex-1">
                    <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-purple-500" : "bg-white/10"}`} />
                    <p className={`text-[10px] mt-1 ${i === step ? "text-purple-400" : "text-white/30"}`}>{s.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-6 min-h-[280px] flex flex-col">
            <AnimatePresence mode="wait">
              {steps[step]?.id === "install" && (
                <motion.div
                  key="install"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 flex flex-col"
                >
                  {installed ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg">App Installed!</h3>
                      <p className="text-white/50 text-sm">You can now find it on your Home Screen</p>
                    </div>
                  ) : installPromptAvailable ? (
                    <AutoInstallStep onInstall={handleInstall} />
                  ) : platform === "ios" ? (
                    <IOSInstallGuide />
                  ) : (
                    <AndroidManualGuide />
                  )}

                  {!installed && (
                    <div className="mt-auto pt-4 flex gap-3">
                      <button
                        onClick={() => setStep(step + 1)}
                        className="flex-1 py-3 rounded-2xl bg-white/[0.06] text-white/60 text-sm font-medium"
                        data-testid="wizard-skip-install"
                      >
                        Skip
                      </button>
                      {installPromptAvailable ? (
                        <button
                          onClick={handleInstall}
                          className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                          data-testid="wizard-install-app"
                        >
                          <Download className="w-4 h-4" /> Install App
                        </button>
                      ) : (
                        <button
                          onClick={() => setStep(step + 1)}
                          className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                          data-testid="wizard-done-install"
                        >
                          I've Done This <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {steps[step]?.id === "notify" && (
                <motion.div
                  key="notify"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 flex flex-col"
                >
                  <NotifyStep
                    platform={platform}
                    standalone={standalone}
                    status={notifStatus}
                    error={notifError}
                  />

                  <div className="mt-auto pt-4">
                    {notifStatus === "done" ? (
                      <button
                        onClick={finish}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
                        data-testid="wizard-finish"
                      >
                        <CheckCircle2 className="w-4 h-4" /> All Set — Let's Go!
                      </button>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={finish}
                          className="flex-1 py-3 rounded-2xl bg-white/[0.06] text-white/60 text-sm font-medium"
                          data-testid="wizard-skip-notify"
                        >
                          Maybe Later
                        </button>
                        {pushSupported() && notifStatus !== "loading" && (
                          <button
                            onClick={handleEnableNotifications}
                            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                            data-testid="wizard-enable-push"
                          >
                            <Bell className="w-4 h-4" /> Enable
                          </button>
                        )}
                        {notifStatus === "loading" && (
                          <div className="flex-1 py-3 rounded-2xl bg-purple-500/30 text-white text-sm font-semibold flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Enabling...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AutoInstallStep({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center mx-auto">
        <Download className="w-8 h-8 text-purple-400" />
      </div>
      <h3 className="text-white font-semibold text-lg">Install the App</h3>
      <p className="text-white/50 text-sm">
        Add this app to your Home Screen for quick access and a full-screen experience — just like a real app.
      </p>
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2 text-left">
        <ul className="space-y-2">
          <li className="text-white/50 text-xs flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            Opens full screen — no browser bars
          </li>
          <li className="text-white/50 text-xs flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            Quick access from your Home Screen
          </li>
          <li className="text-white/50 text-xs flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            Required for push notifications on some devices
          </li>
        </ul>
      </div>
    </div>
  );
}

function IOSInstallGuide() {
  return (
    <div className="space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mx-auto">
        <Download className="w-7 h-7 text-blue-400" />
      </div>
      <h3 className="text-white text-center font-semibold">Install on iPhone</h3>
      <p className="text-white/50 text-xs text-center">
        Add this app to your Home Screen to receive notifications and get the full experience
      </p>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-2">
        <p className="text-amber-300 text-xs text-center font-medium">
          You must use Safari for this step
        </p>
      </div>

      <div className="space-y-3">
        <StepItem icon={<ArrowUpFromLine className="w-4 h-4" />}>
          <span className="text-white font-medium">Step 1:</span> Tap the{" "}
          <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-medium">
            <ArrowUpFromLine className="w-3 h-3" /> Share
          </span>{" "}
          button at the bottom of Safari
        </StepItem>
        <StepItem icon={<Plus className="w-4 h-4" />}>
          <span className="text-white font-medium">Step 2:</span> Scroll down and tap{" "}
          <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[11px] font-medium">
            Add to Home Screen
          </span>
        </StepItem>
        <StepItem icon={<CheckCircle2 className="w-4 h-4" />}>
          <span className="text-white font-medium">Step 3:</span> Tap{" "}
          <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-medium">Add</span>{" "}
          then open the app from your Home Screen
        </StepItem>
      </div>
    </div>
  );
}

function AndroidManualGuide() {
  return (
    <div className="space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mx-auto">
        <Download className="w-7 h-7 text-green-400" />
      </div>
      <h3 className="text-white text-center font-semibold">Install on Android</h3>
      <p className="text-white/50 text-xs text-center">
        Add this app to your Home Screen for quick access
      </p>

      <div className="space-y-3">
        <StepItem icon={<Ellipsis className="w-4 h-4" />}>
          <span className="text-white font-medium">Step 1:</span> Tap the{" "}
          <span className="inline-flex items-center gap-1 bg-white/10 text-white px-1.5 py-0.5 rounded text-[11px] font-medium">
            <Ellipsis className="w-3 h-3" /> Menu
          </span>{" "}
          (three dots) at the top right
        </StepItem>
        <StepItem icon={<Plus className="w-4 h-4" />}>
          <span className="text-white font-medium">Step 2:</span> Tap{" "}
          <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[11px] font-medium">
            Add to Home screen
          </span>{" "}
          or{" "}
          <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[11px] font-medium">
            Install app
          </span>
        </StepItem>
        <StepItem icon={<CheckCircle2 className="w-4 h-4" />}>
          <span className="text-white font-medium">Step 3:</span> Tap{" "}
          <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[11px] font-medium">Install</span>{" "}
          to confirm
        </StepItem>
      </div>
    </div>
  );
}

function NotifyStep({ platform, standalone, status, error }: {
  platform: Platform;
  standalone: boolean;
  status: string;
  error: string;
}) {
  const hasPush = pushSupported();

  if (status === "done") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-white font-semibold text-lg">Notifications Enabled!</h3>
        <p className="text-white/50 text-sm">You'll get a notification when your travel agent replies</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center mx-auto">
        <Bell className="w-7 h-7 text-purple-400" />
      </div>
      <h3 className="text-white text-center font-semibold">Stay in the Loop</h3>
      <p className="text-white/50 text-xs text-center">
        Get instant notifications when your travel agent sends you a message or updates your quote.
      </p>

      {!hasPush && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          {platform === "ios" && !standalone ? (
            <p className="text-amber-300 text-xs text-center">
              On iPhone, you need to open this app from your Home Screen to enable notifications.
              Go back and follow the install steps first.
            </p>
          ) : (
            <p className="text-amber-300 text-xs text-center">
              Notifications aren't available in this browser. Try opening this page in Chrome or Safari directly.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <p className="text-red-300 text-xs text-center">{error}</p>
        </div>
      )}

      {hasPush && !error && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2">
          <p className="text-white/70 text-xs font-medium">When you tap Enable:</p>
          <ul className="space-y-1.5">
            <li className="text-white/40 text-xs flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#8226;</span>
              Your browser will ask to allow notifications
            </li>
            <li className="text-white/40 text-xs flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#8226;</span>
              Tap <span className="text-white/60 font-medium">"Allow"</span> when prompted
            </li>
            <li className="text-white/40 text-xs flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#8226;</span>
              You can turn this off anytime
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function StepItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
      <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
        {icon}
      </div>
      <div className="text-white/60 text-xs leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}
