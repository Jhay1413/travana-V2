import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NotificationToast } from "@/components/notification-toast";
import { AppHeader } from "./app-header";
import { AppSidenav } from "./app-sidenav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidenav />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 overflow-y-auto" data-testid="app-content">
          {children}
        </main>
      </SidebarInset>
      <NotificationToast />
    </SidebarProvider>
  );
}
