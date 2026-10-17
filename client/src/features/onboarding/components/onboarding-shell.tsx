import type { ReactNode } from "react";
import { LogOut, Plane } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/** Full-screen frame: the 84px navy icon rail and a 1280px content board. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen bg-social-page text-[14px] text-foreground" data-testid="onboarding-shell">
      <nav
        aria-label="Travana"
        className="sticky top-0 flex h-screen w-[84px] flex-none flex-col items-center justify-between bg-social-navy py-5"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-social-orange text-slate-900" aria-hidden>
          <Plane className="size-5" />
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => logout()}
          className="grid size-11 place-items-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-5" />
        </button>
      </nav>
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
