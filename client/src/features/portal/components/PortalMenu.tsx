import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import type { PortalBranding } from "../api/portal-branding";
import { toRoman } from "../lib/quote-format";
import { usePortalOverlayContainer } from "../theme/PortalThemeProvider";
import { AgencyMark, PortalButton } from "./brand";

export interface PortalMenuItem {
  key: string;
  label: string;
  path: string;
  /** Right-hand text such as "3 to view". */
  count?: string;
}

/** The text after the number in the menu's quotes and bookings rows; none when there is nothing to say. */
export function menuCount(n: number | undefined, suffix: string): string | undefined {
  return n && n > 0 ? `${n} ${suffix}` : undefined;
}

/**
 * Full-screen navy menu, as in the reference: logo and Close; the customer's name as an eyebrow; a hairline list with
 * Roman numerals and 38px serif labels (the current page in italic) and counts; the agent, "Message <agent>" (opens the
 * Message sheet) and Log out.
 */
export function PortalMenu({
  open,
  onOpenChange,
  branding,
  customerName,
  agent,
  items,
  currentKey,
  onNavigate,
  onMessageAgent,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branding: PortalBranding;
  customerName: string;
  /** The agent's first name, or "your agent". */
  agent: string;
  items: readonly PortalMenuItem[];
  currentKey: string | null;
  onNavigate: (path: string) => void;
  /** "Message <agent>": opens the Message sheet (the menu closes first). */
  onMessageAgent: () => void;
  onLogout: () => void;
}) {
  const container = usePortalOverlayContainer();
  const agentFull = branding.agentName;
  const go = (path: string) => {
    onOpenChange(false);
    onNavigate(path);
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Content
          className="fixed inset-0 z-[62] flex flex-col overflow-y-auto bg-[hsl(var(--portal-navy-deep))] px-7 pb-10 pt-[22px] text-white focus:outline-none"
          data-testid="portal-menu"
        >
          <div className="flex items-center justify-between">
            <AgencyMark branding={branding} tone="dark" />
            <DialogPrimitive.Close asChild>
              <PortalButton variant="link" className="text-white hover:text-white/80" data-testid="menu-close">
                Close
              </PortalButton>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="portal-eyebrow mt-14 text-accent" data-testid="menu-customer">
            {customerName || "Menu"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Go to a page of your customer portal</DialogPrimitive.Description>
          <nav aria-label="Portal pages" className="mt-[22px] flex flex-col gap-1.5">
            {items.map((it, i) => {
              const current = it.key === currentKey;
              return (
                <button
                  key={it.key}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => go(it.path)}
                  className="flex min-h-[72px] w-full items-baseline gap-[18px] border-t border-white/[0.14] py-3.5 text-left"
                  data-testid={`menu-item-${it.key}`}
                >
                  <span className="portal-serif w-[30px] flex-none text-xl text-accent" aria-hidden>
                    {toRoman(i + 1)}
                  </span>
                  <span className={cn("portal-serif min-w-0 flex-1 break-words text-[38px] font-light leading-[1.1]", current && "italic")}>{it.label}</span>
                  {it.count && (
                    <span className="text-xs uppercase tracking-[0.2em] text-white/60" data-testid={`menu-count-${it.key}`}>
                      {it.count}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="border-t border-white/[0.14]" />
          </nav>
          <div className="mt-auto flex flex-col items-start gap-[18px] pt-12">
            <p className="text-sm leading-[1.7] text-white/70">
              Your travel agent
              {agentFull && (
                <>
                  <br />
                  <span className="portal-serif text-[22px] text-white" data-testid="menu-agent-name">
                    {agentFull}
                  </span>
                </>
              )}
            </p>
            <PortalButton
              variant="light"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onMessageAgent();
              }}
              data-testid="menu-message-agent"
            >
              {agent === "your agent" ? "Message your agent" : `Message ${agent}`}
            </PortalButton>
            <PortalButton variant="link" className="self-center text-white/70 hover:text-white" onClick={onLogout} data-testid="menu-logout">
              Log out
            </PortalButton>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
