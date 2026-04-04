import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2, Inbox, ChevronRight, Home, Bell, BellOff } from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import { usePortalMessages, useSendMessage, getPortalToken, type PortalMessage } from "@/hooks/use-portal-api";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

const fallbackMessages: PortalMessage[] = [];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function pushAvailable(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function NotificationCard({ onEnabled }: { onEnabled: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "unsupported">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const missing: string[] = [];
    if (!("serviceWorker" in navigator)) missing.push("ServiceWorker");
    if (!("PushManager" in window)) missing.push("PushManager");
    if (!("Notification" in window)) missing.push("Notification");
    if (missing.length > 0) {
      setStatus("unsupported");
      setErrorMsg(`Not available in this browser (missing: ${missing.join(", ")}). Try Chrome or Safari on your phone.`);
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
      if (!token) { setStatus("error"); setErrorMsg("Not logged in"); return; }

      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.register("/portal-sw.js");
        await navigator.serviceWorker.ready;
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(`Service worker failed: ${e?.message || "unknown"}`);
        return;
      }

      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(`Permission request failed: ${e?.message || "unknown"}`);
        return;
      }
      if (permission !== "granted") {
        setStatus("error");
        setErrorMsg(permission === "denied" ? "Notifications blocked. Check your browser settings." : "Permission not granted — please tap 'Allow' when prompted.");
        return;
      }

      const resp = await fetch("/api/portal/push/vapid-key");
      const { publicKey } = await resp.json();
      if (!publicKey) { setStatus("error"); setErrorMsg("Server config error — VAPID key missing"); return; }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        } catch (e: any) {
          setStatus("error");
          setErrorMsg(`Push subscribe failed: ${e?.message || "unknown"}`);
          return;
        }
      }

      const subResp = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!subResp.ok) {
        const errData = await subResp.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(errData.error || "Subscription failed on server");
        return;
      }

      setStatus("idle");
      onEnabled();
    } catch (err: any) {
      console.error("Push enable error:", err);
      setStatus("error");
      setErrorMsg(err?.message || "Something went wrong");
    }
  };

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3"
    >
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-400/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-0.5">Enable notifications</p>
            <p className="text-xs text-white/50 mb-3">Get notified instantly when your travel agent replies</p>
            {errorMsg && (
              <p className="text-xs text-red-400 mb-2">{errorMsg}</p>
            )}
            <div className="flex gap-2">
              {status !== "unsupported" && (
                <button
                  onClick={handleEnable}
                  disabled={status === "loading"}
                  className="bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                  data-testid="button-enable-push-messages"
                >
                  {status === "loading" ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Enabling...</>
                  ) : (
                    <><Bell className="w-3 h-3" /> Turn on notifications</>
                  )}
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="text-white/40 hover:text-white/60 text-xs px-3 py-2 transition-colors"
                data-testid="button-dismiss-push-messages"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-16 w-3/4" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-2/3" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-20 w-3/4" />
      </div>
    </div>
  );
}

export default function PortalMessagesPage() {
  const { data: apiMessages, isLoading, isError } = usePortalMessages();
  const [localMessages, setLocalMessages] = useState<PortalMessage[]>([]);
  const [input, setInput] = useState("");
  const [pushEnabled, setPushEnabled] = useState(true);
  const sendMutation = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pushAvailable()) { setPushEnabled(false); return; }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration("/portal-sw.js").then(reg => {
        if (reg) reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub));
        else setPushEnabled(false);
      });
    } else {
      setPushEnabled(false);
    }
  }, []);

  const baseMessages = apiMessages ?? (isError ? fallbackMessages : []);
  const apiIds = new Set(baseMessages.map(m => m.text));
  const pendingLocal = localMessages.filter(m => !apiIds.has(m.text));
  const allMessages = [...baseMessages, ...pendingLocal];
  const loading = isLoading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSend = async () => {
    if (!input.trim() || sendMutation.isPending) return;
    const text = input.trim();
    setInput("");

    const newMsg: PortalMessage = {
      id: "client-" + Date.now(),
      sender: "client",
      text,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, newMsg]);

    try {
      await sendMutation.mutateAsync(text);
    } catch {
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [, setLocation] = useLocation();

  return (
    <PortalLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] max-w-lg mx-auto">
        <div className="px-4 pt-6 pb-3">
          <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-messages">
            <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </button>
            <ChevronRight className="w-3 h-3 text-white/20" />
            <span className="text-white/70">Messages</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white" data-testid="text-messages-title">Messages</h1>
          </div>
        </div>

        {!pushEnabled && (
          <NotificationCard onEnabled={() => setPushEnabled(true)} />
        )}

        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <MessageSkeleton />
          ) : allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <GlassCard className="p-8 text-center">
                <Inbox className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/60 font-medium mb-1" data-testid="text-empty-messages">No messages yet</p>
                <p className="text-white/40 text-sm">Start a conversation with your travel agent</p>
              </GlassCard>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {allMessages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === "client" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  {msg.sender === "agent" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center mr-2 mt-1 shrink-0">
                      <span className="text-xs font-bold text-purple-400">{msg.agent_name?.[0] || "A"}</span>
                    </div>
                  )}
                  <div className="max-w-[80%]">
                    {msg.sender === "agent" && msg.agent_name && (
                      <p className="text-xs text-white/40 mb-1 ml-1" data-testid={`text-agent-name-${msg.id}`}>{msg.agent_name}</p>
                    )}
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === "client"
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-lg"
                          : "backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] text-white/90 rounded-bl-lg"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <p className={`text-[10px] text-white/30 mt-1 ${msg.sender === "client" ? "text-right mr-1" : "ml-1"}`} data-testid={`text-timestamp-${msg.id}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-2 pt-2">
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-2xl flex items-end gap-2 p-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm px-3 py-2 focus:outline-none resize-none max-h-24"
              data-testid="input-message"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              data-testid="button-send-message"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
