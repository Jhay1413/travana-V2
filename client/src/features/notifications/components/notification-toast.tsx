import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle, LifeBuoy, MessageSquare, X } from "lucide-react";
import { useCurrentUser, useNotifications } from "@/hooks/queries";
import { useMarkNotificationRead } from "@/hooks/mutations";

const NOTIF_STYLE: Record<string, { icon: typeof Bell; label: string; border: string; bg: string; iconBg: string; iconColor: string; labelColor: string; titleColor: string; bodyColor: string; btnColor: string; btnHover: string; dismissColor: string; dismissHover: string }> = {
  chat_message: {
    icon: MessageSquare,
    label: "New Message",
    border: "border-blue-200/60 dark:border-blue-500/30",
    bg: "bg-blue-50/95 dark:bg-blue-950/90",
    iconBg: "bg-blue-200/60 dark:bg-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    labelColor: "text-blue-600/80 dark:text-blue-400/80",
    titleColor: "text-blue-900 dark:text-blue-100",
    bodyColor: "text-blue-800/75 dark:text-blue-200/70",
    btnColor: "text-blue-600 dark:text-blue-400",
    btnHover: "hover:text-blue-800 dark:hover:text-blue-200",
    dismissColor: "text-blue-500/60",
    dismissHover: "hover:bg-blue-200/50 hover:text-blue-700 dark:hover:bg-blue-500/20 dark:hover:text-blue-300",
  },
  task_due: {
    icon: CheckCircle,
    label: "Task Due",
    border: "border-orange-200/60 dark:border-orange-500/30",
    bg: "bg-orange-50/95 dark:bg-orange-950/90",
    iconBg: "bg-orange-200/60 dark:bg-orange-500/20",
    iconColor: "text-orange-600 dark:text-orange-400",
    labelColor: "text-orange-600/80 dark:text-orange-400/80",
    titleColor: "text-orange-900 dark:text-orange-100",
    bodyColor: "text-orange-800/75 dark:text-orange-200/70",
    btnColor: "text-orange-600 dark:text-orange-400",
    btnHover: "hover:text-orange-800 dark:hover:text-orange-200",
    dismissColor: "text-orange-500/60",
    dismissHover: "hover:bg-orange-200/50 hover:text-orange-700 dark:hover:bg-orange-500/20 dark:hover:text-orange-300",
  },
  ticket_due: {
    icon: LifeBuoy,
    label: "Ticket Alert",
    border: "border-red-200/60 dark:border-red-500/30",
    bg: "bg-red-50/95 dark:bg-red-950/90",
    iconBg: "bg-red-200/60 dark:bg-red-500/20",
    iconColor: "text-red-600 dark:text-red-400",
    labelColor: "text-red-600/80 dark:text-red-400/80",
    titleColor: "text-red-900 dark:text-red-100",
    bodyColor: "text-red-800/75 dark:text-red-200/70",
    btnColor: "text-red-600 dark:text-red-400",
    btnHover: "hover:text-red-800 dark:hover:text-red-200",
    dismissColor: "text-red-500/60",
    dismissHover: "hover:bg-red-200/50 hover:text-red-700 dark:hover:bg-red-500/20 dark:hover:text-red-300",
  },
};

const DEFAULT_STYLE = NOTIF_STYLE.chat_message;

export function NotificationToast() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id || "";
  const { data: notifications = [] } = useNotifications(userId);
  const markReadMutation = useMarkNotificationRead(userId);
  const [, setLocation] = useLocation();

  const [toastQueue, setToastQueue] = useState<Array<{ id: string; type: string; title: string; message: string; link: string | null }>>([]);
  const [visible, setVisible] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHidingRef = useRef(false);

  useEffect(() => {
    if (!userId || !notifications.length) return;

    const unreadToShow = notifications.filter(
      (n) => !n.read && !shownIdsRef.current.has(n.id)
    );

    if (unreadToShow.length > 0) {
      unreadToShow.forEach((n) => shownIdsRef.current.add(n.id));
      setToastQueue((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = unreadToShow
          .filter((n) => !existingIds.has(n.id))
          .map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, link: n.link }));
        return [...prev, ...newItems];
      });
    }
  }, [notifications, userId]);

  useEffect(() => {
    if (toastQueue.length > 0 && !visible && !isHidingRef.current) {
      setVisible(true);
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      const notifId = toastQueue[0]?.id;
      autoHideTimer.current = setTimeout(() => {
        isHidingRef.current = true;
        setVisible(false);
        if (notifId) markReadMutation.mutate(notifId);
        setTimeout(() => {
          setToastQueue((prev) => prev.slice(1));
          isHidingRef.current = false;
        }, 350);
      }, 6000);
    }
  }, [toastQueue, visible]);

  const currentNotif = toastQueue[0] || null;

  const dismiss = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    setVisible(false);
    if (currentNotif) markReadMutation.mutate(currentNotif.id);
    setTimeout(() => setToastQueue((prev) => prev.slice(1)), 350);
  };

  const handleClick = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    if (currentNotif) {
      markReadMutation.mutate(currentNotif.id);
      if (currentNotif.link) setLocation(currentNotif.link);
    }
    setVisible(false);
    setTimeout(() => setToastQueue((prev) => prev.slice(1)), 350);
  };

  if (!currentNotif) return null;

  const style = NOTIF_STYLE[currentNotif.type] || DEFAULT_STYLE;
  const Icon = style.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={currentNotif.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`fixed bottom-5 right-5 z-[10001] w-[360px] rounded-2xl border ${style.border} ${style.bg} p-4 shadow-xl backdrop-blur-xl cursor-pointer`}
          data-testid="popup-notification-toast"
          onClick={handleClick}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
              <Icon className={`h-4 w-4 ${style.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${style.labelColor}`} data-testid="text-notif-toast-label">
                  {style.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); dismiss(); }}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${style.dismissColor} transition ${style.dismissHover}`}
                  data-testid="button-notif-toast-dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className={`mt-1 text-sm font-semibold ${style.titleColor}`} data-testid="text-notif-toast-title">
                {currentNotif.title}
              </div>
              <p className={`mt-1 text-xs leading-relaxed ${style.bodyColor} line-clamp-2`} data-testid="text-notif-toast-body">
                {currentNotif.message}
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dismiss(); }}
                className={`mt-2.5 text-[11px] font-semibold ${style.btnColor} transition ${style.btnHover}`}
                data-testid="button-notif-toast-dismiss-text"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
