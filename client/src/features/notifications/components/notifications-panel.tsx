import { Fragment, useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNotifications } from "@/hooks/queries";
import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useClearAllNotifications,
} from "@/hooks/mutations";
import type { Notification } from "@/features/notifications/types";
import { useLocation } from "wouter";

interface NotificationsPanelProps {
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

export function NotificationsPanel({ userId }: NotificationsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications = [], isLoading } = useNotifications(userId);

  // "Unread" is the only count the API exposes (see `Notification.read` /
  // `GET /api/v2/notifications/unread`) — there's no separate "new" or
  // "important" concept, so the bell badge is the unread count. Derived from
  // the same list the panel renders (rather than a second query against
  // /unread) so the badge can never disagree with what's shown inside.
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMutation = useMarkNotificationRead(userId);
  const markAllReadMutation = useMarkAllNotificationsRead(userId);
  const deleteMutation = useDeleteNotification(userId);
  const clearAllMutation = useClearAllNotifications(userId);

  const handleConfirmClearAll = () => {
    clearAllMutation.mutate(undefined, {
      onSuccess: () => setShowClearAllConfirm(false),
    });
  };

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
    <Fragment>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="relative h-9 w-9 rounded-full p-0 text-white/85 hover:bg-white/10 hover:text-white"
          data-testid="button-notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#2E3D50]"
              data-testid="badge-notifications-unread"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>

        <SheetContent
          side="right"
          hideClose
          className="flex w-full flex-col gap-0 border-0 bg-white p-0 shadow-2xl dark:bg-[#0a0a0a] sm:max-w-md"
          data-testid="panel-notifications"
        >
          {/* Flat navy bar, matching the app header it opens from (bg-[#2E3D50])
              rather than FormDrawer's teal gradient — that teal is the app's
              "you're editing something" signal for the quote/booking/enquiry
              create-edit drawers, and this panel is a read-only feed, not a
              form. */}
          <div className="flex h-16 shrink-0 items-center justify-between bg-[#2E3D50] px-5 dark:bg-[#1b2530]">
            <SheetHeader className="contents">
              <SheetTitle className="text-base font-semibold text-white">Notifications</SheetTitle>
              <SheetDescription className="sr-only">
                Your recent notifications. Click one to open it, or mark it as read.
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  className="h-8 gap-1 text-xs text-white/85 hover:bg-white/10 hover:text-white"
                  data-testid="button-mark-all-read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearAllConfirm(true)}
                  className="h-8 gap-1 text-xs text-white/60 hover:bg-white/10 hover:text-white/90 dark:text-white/50 dark:hover:text-white/85"
                  data-testid="button-clear-all-notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-white/85 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
                data-testid="button-notifications-close"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-black/50 dark:text-white/50">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-black/5 dark:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer transition-colors ${
                    !notification.read ? "bg-blue-50/50 dark:bg-blue-500/10" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate dark:text-white/90">{notification.title}</p>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-black/60 dark:text-white/60 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-black/40 dark:text-white/40 mt-1">
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
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
        </SheetContent>
      </Sheet>

      <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your entire notification history. This action can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="button-clear-all-notifications-cancel"
              disabled={clearAllMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-clear-all-notifications-confirm"
              disabled={clearAllMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmClearAll();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {clearAllMutation.isPending ? "Clearing..." : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Fragment>
  );
}
