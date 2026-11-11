import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCircle, Eye, LifeBuoy, MessageSquare, Pencil, Share2, UserPlus, X } from "lucide-react";
import { useCurrentUser, useNotifications } from "@/hooks/queries";
import { useMarkNotificationRead } from "@/hooks/mutations";
import { isNotificationsPanelOpen } from "@/features/notifications/lib/panel-open-store";

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
  task_assigned: {
    icon: UserPlus,
    label: "Task Assigned",
    border: "border-purple-200/60 dark:border-purple-500/30",
    bg: "bg-purple-50/95 dark:bg-purple-950/90",
    iconBg: "bg-purple-200/60 dark:bg-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
    labelColor: "text-purple-600/80 dark:text-purple-400/80",
    titleColor: "text-purple-900 dark:text-purple-100",
    bodyColor: "text-purple-800/75 dark:text-purple-200/70",
    btnColor: "text-purple-600 dark:text-purple-400",
    btnHover: "hover:text-purple-800 dark:hover:text-purple-200",
    dismissColor: "text-purple-500/60",
    dismissHover: "hover:bg-purple-200/50 hover:text-purple-700 dark:hover:bg-purple-500/20 dark:hover:text-purple-300",
  },
  ticket_assigned: {
    icon: UserPlus,
    label: "Ticket Assigned",
    border: "border-teal-200/60 dark:border-teal-500/30",
    bg: "bg-teal-50/95 dark:bg-teal-950/90",
    iconBg: "bg-teal-200/60 dark:bg-teal-500/20",
    iconColor: "text-teal-600 dark:text-teal-400",
    labelColor: "text-teal-600/80 dark:text-teal-400/80",
    titleColor: "text-teal-900 dark:text-teal-100",
    bodyColor: "text-teal-800/75 dark:text-teal-200/70",
    btnColor: "text-teal-600 dark:text-teal-400",
    btnHover: "hover:text-teal-800 dark:hover:text-teal-200",
    dismissColor: "text-teal-500/60",
    dismissHover: "hover:bg-teal-200/50 hover:text-teal-700 dark:hover:bg-teal-500/20 dark:hover:text-teal-300",
  },
  quote_viewed: {
    icon: Eye,
    label: "Quote viewed",
    border: "border-sky-200/60 dark:border-sky-500/30",
    bg: "bg-sky-50/95 dark:bg-sky-950/90",
    iconBg: "bg-sky-200/60 dark:bg-sky-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
    labelColor: "text-sky-600/80 dark:text-sky-400/80",
    titleColor: "text-sky-900 dark:text-sky-100",
    bodyColor: "text-sky-800/75 dark:text-sky-200/70",
    btnColor: "text-sky-600 dark:text-sky-400",
    btnHover: "hover:text-sky-800 dark:hover:text-sky-200",
    dismissColor: "text-sky-500/60",
    dismissHover: "hover:bg-sky-200/50 hover:text-sky-700 dark:hover:bg-sky-500/20 dark:hover:text-sky-300",
  },
  quote_shared: {
    icon: Share2,
    label: "Quote shared",
    border: "border-indigo-200/60 dark:border-indigo-500/30",
    bg: "bg-indigo-50/95 dark:bg-indigo-950/90",
    iconBg: "bg-indigo-200/60 dark:bg-indigo-500/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    labelColor: "text-indigo-600/80 dark:text-indigo-400/80",
    titleColor: "text-indigo-900 dark:text-indigo-100",
    bodyColor: "text-indigo-800/75 dark:text-indigo-200/70",
    btnColor: "text-indigo-600 dark:text-indigo-400",
    btnHover: "hover:text-indigo-800 dark:hover:text-indigo-200",
    dismissColor: "text-indigo-500/60",
    dismissHover: "hover:bg-indigo-200/50 hover:text-indigo-700 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300",
  },
  quote_accepted: {
    icon: CheckCircle,
    label: "Quote accepted",
    border: "border-emerald-200/60 dark:border-emerald-500/30",
    bg: "bg-emerald-50/95 dark:bg-emerald-950/90",
    iconBg: "bg-emerald-200/60 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    labelColor: "text-emerald-600/80 dark:text-emerald-400/80",
    titleColor: "text-emerald-900 dark:text-emerald-100",
    bodyColor: "text-emerald-800/75 dark:text-emerald-200/70",
    btnColor: "text-emerald-600 dark:text-emerald-400",
    btnHover: "hover:text-emerald-800 dark:hover:text-emerald-200",
    dismissColor: "text-emerald-500/60",
    dismissHover: "hover:bg-emerald-200/50 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300",
  },
  quote_changes_requested: {
    icon: Pencil,
    label: "Changes requested",
    border: "border-amber-200/60 dark:border-amber-500/30",
    bg: "bg-amber-50/95 dark:bg-amber-950/90",
    iconBg: "bg-amber-200/60 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    labelColor: "text-amber-600/80 dark:text-amber-400/80",
    titleColor: "text-amber-900 dark:text-amber-100",
    bodyColor: "text-amber-800/75 dark:text-amber-200/70",
    btnColor: "text-amber-600 dark:text-amber-400",
    btnHover: "hover:text-amber-800 dark:hover:text-amber-200",
    dismissColor: "text-amber-500/60",
    dismissHover: "hover:bg-amber-200/50 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-300",
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

      // The notifications panel now auto-opens for new unread arrivals (see
      // notifications-panel.tsx). A toast for a notification that just
      // opened — or already has open — the panel would be redundant, since
      // the user is already looking at it in the list, so skip queuing one
      // while the panel is open. The ids are still marked as shown above so
      // they don't toast later either.
      if (isNotificationsPanelOpen()) return;

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
