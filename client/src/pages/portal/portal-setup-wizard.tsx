import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Bell, CheckCircle2, X,
  Download, Plus, ArrowUpFromLine, Ellipsis,
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
  const [platform] = useState<Platform>(detectPlatform);
  const [standalone] = useState(isStandalone);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(!!deferredInstallPrompt);
  const [installed, setInstalled] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notifError, setNotifError] = useState("");
  const hasPush = pushSupported();
  const [showInstallTip, setShowInstallTip] = useState(platform === "ios" && !hasPush);

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
        setNotifError(perm === "denied" ? "Blocked — open your browser settings and allow notifications for this site, then try again." : "Permission not granted — please tap 'Allow' when prompted.");
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
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!saveRes.ok) throw new Error(`Failed: ${saveRes.status}`);

      setNotifStatus("done");
    } catch (err: any) {
      setNotifError(err?.message || "Something went wrong");
      setNotifStatus("error");
    }
  };

  if (!open) return null;

  const allDone = notifStatus === "done" && (installed || standalone || platform === "desktop");
  const notifDoneOnly = notifStatus === "done" && !installed && !standalone && platform !== "desktop";

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
          className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-gradient-to-b from-[#1a1030] to-[#0f0a1e] border border-white/[0.12] rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto"
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
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white text-lg font-bold">Welcome!</h2>
                <p className="text-white/40 text-xs">Get set up in seconds</p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-4">
            <AnimatePresence mode="wait">
              {allDone ? (
                <motion.div
                  key="alldone"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center gap-3 text-center py-6"
                >
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-white font-bold text-xl">You're All Set!</h3>
                  <p className="text-white/50 text-sm">You'll get notified when your travel agent messages you</p>
                  <button
                    onClick={finish}
                    className="mt-4 w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2"
                    data-testid="wizard-finish"
                  >
                    Let's Go!
                  </button>
                </motion.div>
              ) : (
                <motion.div key="setup" className="space-y-4">
                  {/* NOTIFICATIONS SECTION */}
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">Message Notifications</h3>
                        <p className="text-white/40 text-xs">Know instantly when your agent replies</p>
                      </div>
                      {notifStatus === "done" && (
                        <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto shrink-0" />
                      )}
                    </div>

                    {notifStatus === "done" ? (
                      <p className="text-green-400/80 text-xs">Notifications enabled — you're all set!</p>
                    ) : hasPush ? (
                      <>
                        {notifError && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">
                            <p className="text-red-300 text-xs">{notifError}</p>
                          </div>
                        )}
                        <button
                          onClick={handleEnableNotifications}
                          disabled={notifStatus === "loading"}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
                          data-testid="wizard-enable-push"
                        >
                          {notifStatus === "loading" ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Setting up...
                            </>
                          ) : notifStatus === "error" ? (
                            <>
                              <Bell className="w-4 h-4" /> Try Again
                            </>
                          ) : (
                            <>
                              <Bell className="w-4 h-4" /> Turn On Notifications
                            </>
                          )}
                        </button>
                        <p className="text-white/30 text-[10px] text-center mt-2">
                          Tap "Allow" when your browser asks — you can turn this off anytime
                        </p>
                      </>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
                        {platform === "ios" ? (
                          <>
                            <p className="text-amber-300 text-xs font-medium">
                              On iPhone, Apple requires you to install this app first.
                            </p>
                            <p className="text-white/40 text-xs">
                              Use the "Add to Home Screen" option below, then open the app from your Home Screen. Notifications will work after that.
                            </p>
                          </>
                        ) : (
                          <p className="text-amber-300 text-xs">
                            Notifications aren't available in this browser. Try opening this page directly in Chrome or Safari.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* INSTALL SECTION — only on mobile, not standalone */}
                  {!standalone && platform !== "desktop" && (
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <Download className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-sm">Add to Home Screen</h3>
                          <p className="text-white/40 text-xs">Open like a real app — no browser bars</p>
                        </div>
                        {installed && (
                          <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto shrink-0" />
                        )}
                      </div>

                      {installed ? (
                        <p className="text-green-400/80 text-xs">Installed! Find it on your Home Screen.</p>
                      ) : installPromptAvailable ? (
                        <button
                          onClick={handleInstall}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                          data-testid="wizard-install-app"
                        >
                          <Download className="w-4 h-4" /> Install App
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowInstallTip(!showInstallTip)}
                            className="w-full py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                            data-testid="wizard-show-install-steps"
                          >
                            <Download className="w-4 h-4 text-blue-400" /> How to Install
                          </button>
                          <AnimatePresence>
                            {showInstallTip && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-3 space-y-2">
                                  {platform === "ios" ? (
                                    <>
                                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-2">
                                        <p className="text-amber-300 text-[11px] font-medium text-center">Use Safari for this step</p>
                                      </div>
                                      <InstallStep num={1} icon={<ArrowUpFromLine className="w-3.5 h-3.5" />}>
                                        Tap <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-medium"><ArrowUpFromLine className="w-3 h-3" /></span> at the bottom of the screen
                                      </InstallStep>
                                      <InstallStep num={2} icon={<Plus className="w-3.5 h-3.5" />}>
                                        Tap <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[11px] font-medium"><Plus className="w-3 h-3" /></span> bottom right &amp; then <span className="text-white font-semibold">"Add to Home Screen"</span>
                                      </InstallStep>
                                      <InstallStep num={3} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                                        Tap <span className="text-white font-semibold">"Add"</span> and open from Home Screen
                                      </InstallStep>
                                    </>
                                  ) : (
                                    <>
                                      <InstallStep num={1} icon={<Ellipsis className="w-3.5 h-3.5" />}>
                                        Tap <span className="text-white font-semibold">&#8942; Menu</span> (top right)
                                      </InstallStep>
                                      <InstallStep num={2} icon={<Plus className="w-3.5 h-3.5" />}>
                                        Tap <span className="text-white font-semibold">"Install app"</span> or <span className="text-white font-semibold">"Add to Home screen"</span>
                                      </InstallStep>
                                      <InstallStep num={3} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                                        Tap <span className="text-white font-semibold">"Install"</span>
                                      </InstallStep>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  )}

                  {/* Bottom actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={finish}
                      className="flex-1 py-3 rounded-2xl bg-white/[0.06] text-white/60 text-sm font-medium"
                      data-testid="wizard-skip"
                    >
                      {notifStatus === "done" ? "Done" : "Maybe Later"}
                    </button>
                    {notifDoneOnly && (
                      <button
                        onClick={finish}
                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
                        data-testid="wizard-continue"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Continue
                      </button>
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

function InstallStep({ num, icon, children }: { num: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
      <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400 text-[10px] font-bold">
        {num}
      </div>
      <div className="text-white/50 text-xs leading-relaxed">{children}</div>
    </div>
  );
}
