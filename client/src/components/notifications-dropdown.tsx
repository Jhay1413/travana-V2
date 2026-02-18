import { useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useNotifications } from "@/hooks/queries";
import { useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification } from "@/hooks/mutations";
import type { Notification } from "@/types/notification";
import { useLocation } from "wouter";

interface NotificationsDropdownProps {
  userId: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB");
}

export function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications = [], isLoading } = useNotifications(userId);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-black/70 transition hover:bg-black/[0.07]"
          data-testid="button-notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[500] w-80 rounded-2xl border border-black/10 bg-white/95 backdrop-blur-xl p-0 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
          <h3 className="text-sm font-semibold text-black/80">Notifications</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium text-black/50 transition hover:bg-black/5 hover:text-black/70"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-black/20" />
              <p className="text-xs font-medium text-black/40">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-black/5 cursor-pointer transition-colors hover:bg-black/[0.02] ${
                  !notification.read ? "bg-blue-50/40" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-black/70 truncate">{notification.title}</p>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-black/50 line-clamp-2 mt-0.5 leading-relaxed">
                    {notification.message}
                  </p>
                  <p className="text-[10px] font-medium text-black/30 mt-1">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>
                <div className="flex gap-0.5 flex-shrink-0">
                  {!notification.read && (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-black/40 transition hover:bg-black/5 hover:text-black/70"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(notification.id);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-black/30 transition hover:bg-red-50 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(notification.id);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
