import { Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { NotificationToast } from "@/features/notifications/components/notification-toast";
import { AppHeader } from "./app-header";
import { AppSidenav } from "./app-sidenav";
import { ImpersonationBanner } from "@/features/platform-admin/components/platform-admin/impersonation-banner";
import { ChatWidget } from "@/features/ai-chat";
// Deep import, not the feature barrel: the barrel re-exports ConversationsInbox
// and the layout is in the main bundle, so a barrel import would pull the whole
// inbox into the entry chunk (same reason as app-sidenav's badge import).
import { ConversationsRealtimeProvider } from "@/features/conversations/components/conversations-realtime-provider";

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ConversationsRealtimeProvider>
      {/* Dark-navy shell: full-height rail on the left (logo at its top), and
          the header bar spanning only the remaining width beside it. Content
          renders in a light panel with a rounded top-left corner. */}
      <div className="flex min-h-screen bg-[#2E3D50]">
        <AppSidenav />
        <div className="flex min-w-0 flex-1 flex-col" data-testid="app-content">
          <AppHeader />
          <ImpersonationBanner />
          <main className="min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 rounded-tl-lg bg-[#F4F6F8] p-4 dark:bg-background md:p-6">
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </main>
        </div>
        <NotificationToast />
        <ChatWidget />
      </div>
    </ConversationsRealtimeProvider>
  );
}
