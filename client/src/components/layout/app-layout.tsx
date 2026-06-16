import { Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { NotificationToast } from "@/components/notification-toast";
import { AppHeader } from "./app-header";
import { AppSidenav } from "./app-sidenav";
import { ImpersonationBanner } from "@/components/platform-admin/impersonation-banner";

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell px-2 py-2 md:px-3 md:py-3 lg:px-4 lg:py-4 min-h-screen">
      <div className="flex w-full gap-3">
        <AppSidenav />
        <div className="flex min-w-0 flex-1 flex-col gap-3" data-testid="app-content">
          <AppHeader />
          <ImpersonationBanner />
          <main className="min-w-0 flex-1">
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </main>
        </div>
      </div>
      <NotificationToast />
    </div>
  );
}
