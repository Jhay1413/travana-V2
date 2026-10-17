import { Link } from "wouter";
import { ConnectedAccountsCard } from "./connected-accounts-card";
import { DefaultsCard } from "./defaults-card";
import { TimeShortcutsCard } from "./time-shortcuts-card";

export function SocialSettingsPage() {
  return (
    <div className="bg-social-page min-h-full p-4 md:p-6">
      <Link href="/social-posts" className="text-sm font-medium text-social-orange-text hover:underline">
        ← Social Posts
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-social-navy">Social accounts and defaults</h1>
      <p className="mb-4 text-sm text-social-muted">Choose where posts go out, and how new posts start.</p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-[1.45]">
          <ConnectedAccountsCard />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <DefaultsCard />
          <TimeShortcutsCard />
        </div>
      </div>
    </div>
  );
}
