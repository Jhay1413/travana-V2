import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoles } from "@/hooks/use-role";
import type { OrgRole } from "@/types/auth/auth.types";
import type { WhatsappWindow } from "../../../api/whatsapp-updates.api";
import { blockedModeNote, updateModeNote, windowHint, type ComposerMode } from "../lib";

const MANAGER_ROLES: OrgRole[] = ["org_admin", "branch_manager", "platform_admin"];
const TICK_MS = 30_000;

export interface WindowNoteProps {
  mode: ComposerMode;
  window: WhatsappWindow | undefined;
  firstName: string;
}

/** The line above the reply box that explains WhatsApp's 24-hour window. */
export function WindowNote({ mode, window, firstName }: WindowNoteProps) {
  const { hasAnyRole } = useRoles();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (mode === "unknown") return;
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [mode]);

  if (mode === "update") {
    return (
      <div
        className="mt-3 flex items-start gap-2 rounded-[10px] bg-amber-400/10 px-3 py-2 text-[12px] leading-[1.45] text-amber-800 dark:text-amber-300"
        data-testid="composer-window-note-update"
      >
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{updateModeNote(window, now)}</span>
      </div>
    );
  }

  if (mode === "blocked") {
    return (
      <div
        className="mt-3 flex items-start gap-2 rounded-[10px] bg-amber-400/10 px-3 py-2 text-[12px] leading-[1.45] text-amber-800 dark:text-amber-300"
        data-testid="composer-window-note-blocked"
      >
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {blockedModeNote(firstName)}
          {hasAnyRole(MANAGER_ROLES) && (
            <>
              {" "}
              <Link href="/agency/integrations" className="font-semibold underline">
                Open Integrations
              </Link>
            </>
          )}
        </span>
      </div>
    );
  }

  if (mode === "free") {
    const hint = windowHint(window, now);
    if (!hint) return null;
    return (
      <div
        className={cn(
          "mt-2 text-[11px]",
          hint.tone === "amber" ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground",
        )}
        data-testid="composer-window-hint"
      >
        {hint.text}
      </div>
    );
  }

  return null;
}
