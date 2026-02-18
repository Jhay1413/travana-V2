import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useNotifications } from "@/hooks/queries";
import { useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification } from "@/hooks/mutations";
import type { Notification } from "@/types/notification";
import { useLocation } from "wouter";

interface NotificationsDropdownProps {
  userId: string;
}

export function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unread" | "all">("unread");
  const [, setLocation] = useLocation();

  const { data: notifications = [], isLoading } = useNotifications(userId);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = activeTab === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  const markReadMutation = useMarkNotificationRead(userId);
  const markAllReadMutation = useMarkAllNotificationsRead(userId);
  const deleteMutation = useDeleteNotification(userId);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      setLocation(notification.link);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0 rounded-full bg-[#ff000073]"
        onClick={() => setOpen(true)}
        data-testid="button-notifications"
      >
        <Bell className="h-5 w-5 text-white/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed right-0 top-0 z-50 h-full w-80 bg-white dark:bg-zinc-900 shadow-2xl border-l border-gray-200 dark:border-zinc-800"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 px-4 py-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                    data-testid="button-close-notifications"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="border-b border-gray-200 dark:border-zinc-800 px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab("unread")}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                        activeTab === "unread"
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                      }`}
                      data-testid="tab-unread"
                    >
                      Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
                    </button>
                    <button
                      onClick={() => setActiveTab("all")}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                        activeTab === "all"
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                      }`}
                      data-testid="tab-all"
                    >
                      All
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Spinner className="h-5 w-5" />
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                      <Bell className="h-10 w-10 mb-2 opacity-50" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {filteredNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition"
                          onClick={() => handleNotificationClick(notification)}
                          data-testid={`notification-${notification.id}`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-zinc-800 p-3">
                  {unreadCount > 0 ? (
                    <button
                      className="w-full rounded-lg bg-gray-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-zinc-700"
                      onClick={() => markAllReadMutation.mutate()}
                      data-testid="button-mark-all-read"
                    >
                      Mark All as Read
                    </button>
                  ) : (
                    <button
                      className="w-full rounded-lg bg-gray-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-zinc-700"
                      data-testid="button-clear-notifications"
                    >
                      Clear Notifications
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
