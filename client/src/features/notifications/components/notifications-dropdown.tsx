import { useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useNotifications } from "@/hooks/queries";
import { useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification } from "@/hooks/mutations";
import type { Notification } from "@/features/notifications/types";
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
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 rounded-full p-0 text-black/60 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          data-testid="button-notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0b0b0f]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-[200]" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              className="h-8 text-xs gap-1"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-none">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-black/50">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-black/5 hover:bg-black/[0.02] cursor-pointer transition-colors ${
                  !notification.read ? "bg-blue-50/50" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{notification.title}</p>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-black/60 line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-xs text-black/40 mt-1">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(notification.id);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(notification.id);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
