import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Bell, CheckCircle2, ChevronRight, X, Share, MoreVertical,
  Download, Monitor, ArrowUpFromLine, Plus, Ellipsis,
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

export default function PortalSetupWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [platform] = useState<Platform>(detectPlatform);
  const [standalone] = useState(isStandalone);
  const [pushOk] = useState(pushSupported);
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notifError, setNotifError] = useState("");

  useEffect(() => {
    const token = getPortalToken();
    if (!token) return;
    if (localStorage.getItem(WIZARD_KEY)) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, []);

  const finish = () => {
    localStorage.setItem(WIZARD_KEY, "1");
    setOpen(false);
  };

  const handleEnableNotifications = async () => {
    setNotifStatus("loading");
    setNotifError("");
    try {
      const reg = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifError(perm === "denied" ? "Blocked — check browser settings" : "Permission not granted");
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

  const totalSteps = platform === "desktop" && standalone ? 1 : 2;

  const needsInstall = !standalone && platform !== "desktop";

  const steps = needsInstall
    ? [{ id: "install", title: "Add to Home Screen" }, { id: "notify", title: "Enable Notifications" }]
    : [{ id: "notify", title: "Enable Notifications" }];

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
          className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-gradient-to-b from-[#1a1030] to-[#0f0a1e] border border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl"
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

            <div className="flex gap-2 mt-4">
              {steps.map((s, i) => (
                <div key={s.id} className="flex-1">
                  <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-purple-500" : "bg-white/10"}`} />
                  <p className={`text-[10px] mt-1 ${i === step ? "text-purple-400" : "text-white/30"}`}>{s.title}</p>
                </div>
              ))}
            </div>
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
                  {platform === "ios" ? <IOSInstallGuide /> : <AndroidInstallGuide />}

                  <div className="mt-auto pt-4 flex gap-3">
                    <button
                      onClick={() => setStep(step + 1)}
                      className="flex-1 py-3 rounded-2xl bg-white/[0.06] text-white/60 text-sm font-medium"
                      data-testid="wizard-skip-install"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => setStep(step + 1)}
                      className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                      data-testid="wizard-done-install"
                    >
                      I've Done This <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
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
                    pushOk={pushOk}
                    status={notifStatus}
                    error={notifError}
                    onEnable={handleEnableNotifications}
                  />

                  <div className="mt-auto pt-4">
                    {notifStatus === "done" ? (
                      <button
                        onClick={finish}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
                        data-testid="wizard-finish"
                      >
                        <CheckCircle2 className="w-4 h-4" /> All Set!
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
                        {pushOk && notifStatus !== "error" && (
                          <button
                            onClick={handleEnableNotifications}
                            disabled={notifStatus === "loading"}
                            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                            data-testid="wizard-enable-push"
                          >
                            {notifStatus === "loading" ? (
                              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enabling...</span>
                            ) : (
                              <>
                                <Bell className="w-4 h-4" /> Enable
                              </>
                            )}
                          </button>
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

function IOSInstallGuide() {
  return (
    <div className="space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mx-auto">
        <Download className="w-7 h-7 text-blue-400" />
      </div>
      <h3 className="text-white text-center font-semibold">Install on iPhone</h3>
      <p className="text-white/50 text-xs text-center">Add this app to your Home Screen for the best experience and to receive notifications</p>

      <div className="space-y-3 mt-2">
        <StepItem number={1} icon={<ArrowUpFromLine className="w-4 h-4" />}>
          Tap the <span className="text-blue-400 font-medium">Share</span> button at the bottom of Safari
          <span className="block text-white/30 text-[10px] mt-0.5">(Square icon with an upward arrow)</span>
        </StepItem>
        <StepItem number={2} icon={<Plus className="w-4 h-4" />}>
          Scroll down and tap <span className="text-white font-medium">"Add to Home Screen"</span>
        </StepItem>
        <StepItem number={3} icon={<CheckCircle2 className="w-4 h-4" />}>
          Tap <span className="text-white font-medium">"Add"</span> in the top right corner
        </StepItem>
      </div>

      <p className="text-amber-400/80 text-[11px] text-center mt-2">
        You must use Safari — this doesn't work in Chrome on iPhone
      </p>
    </div>
  );
}

function AndroidInstallGuide() {
  return (
    <div className="space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mx-auto">
        <Download className="w-7 h-7 text-green-400" />
      </div>
      <h3 className="text-white text-center font-semibold">Install on Android</h3>
      <p className="text-white/50 text-xs text-center">Add this app to your Home Screen for quick access</p>

      <div className="space-y-3 mt-2">
        <StepItem number={1} icon={<Ellipsis className="w-4 h-4" />}>
          Tap the <span className="text-white font-medium">three dots menu</span> (⋮) at the top right of Chrome
        </StepItem>
        <StepItem number={2} icon={<Plus className="w-4 h-4" />}>
          Tap <span className="text-white font-medium">"Add to Home screen"</span> or <span className="text-white font-medium">"Install app"</span>
        </StepItem>
        <StepItem number={3} icon={<CheckCircle2 className="w-4 h-4" />}>
          Tap <span className="text-white font-medium">"Install"</span> to confirm
        </StepItem>
      </div>
    </div>
  );
}

function NotifyStep({ platform, standalone, pushOk, status, error, onEnable }: {
  platform: Platform;
  standalone: boolean;
  pushOk: boolean;
  status: string;
  error: string;
  onEnable: () => void;
}) {
  if (status === "done") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-white font-semibold text-lg">Notifications Enabled!</h3>
        <p className="text-white/50 text-sm">You'll be notified when your travel agent sends you a message</p>
      </div>
    );
  }

  if (!pushOk) {
    const isIOS = platform === "ios";
    return (
      <div className="space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center mx-auto">
          <Bell className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-white text-center font-semibold">Notifications</h3>
        {isIOS && !standalone ? (
          <div className="space-y-2">
            <p className="text-amber-400/80 text-xs text-center">
              On iPhone, notifications only work when this site is added to your Home Screen.
            </p>
            <p className="text-white/40 text-xs text-center">
              Go back to Step 1, add to Home Screen, then open the app from there.
            </p>
          </div>
        ) : (
          <p className="text-white/50 text-xs text-center">
            Push notifications aren't available in your current browser. Try using Chrome on desktop or Android.
          </p>
        )}
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
        Get instant notifications when your travel agent sends you a message, updates a quote, or has exciting deals.
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <p className="text-red-300 text-xs text-center">{error}</p>
        </div>
      )}

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 space-y-2">
        <p className="text-white/70 text-xs font-medium">When you tap Enable:</p>
        <ul className="space-y-1.5">
          <li className="text-white/40 text-xs flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            Your browser will ask to allow notifications
          </li>
          <li className="text-white/40 text-xs flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            Tap <span className="text-white/60 font-medium">"Allow"</span> when prompted
          </li>
          <li className="text-white/40 text-xs flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            You can turn this off anytime in settings
          </li>
        </ul>
      </div>
    </div>
  );
}

function StepItem({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
      <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
        {icon}
      </div>
      <div className="text-white/60 text-xs leading-relaxed pt-0.5">{children}</div>
    </div>
  );
}
