import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { formatMoney } from "../../lib/quote-format";
import { usePortalOverlayContainer } from "../../theme/PortalThemeProvider";
import { PortalButton } from "../brand";

/**
 * The always-reachable decision bar: fixed above the tab bar with the total, "I'm interested" and an overflow
 * for "Not interested" and "Share". The page hides it once a decision is made.
 */
export function QuoteActionBar({
  total,
  pending,
  onInterested,
  onNotInterested,
  onShare,
}: {
  total: number;
  pending: boolean;
  onInterested: () => void;
  onNotInterested: () => void;
  onShare: () => void;
}) {
  const container = usePortalOverlayContainer();
  const bar = (
    <div
      className="fixed inset-x-0 bottom-[calc(66px+max(8px,env(safe-area-inset-bottom)))] z-40 border-t border-border bg-background shadow-[0_-6px_18px_rgba(0,26,58,0.08)]"
      data-testid="quote-actionbar"
    >
      <div className="mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5">
        <div className="order-1 mr-auto shrink-0 leading-tight">
          <span className="portal-caps-label block">Total</span>
          <span className="portal-serif block whitespace-nowrap text-[26px] text-primary" data-testid="actionbar-total">
            {formatMoney(total)}
          </span>
        </div>
        <PortalButton className="order-3 basis-full px-5 min-[430px]:order-2 min-[430px]:basis-auto" disabled={pending} onClick={onInterested} data-testid="button-interested">
          I&apos;m interested
        </PortalButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="order-2 inline-flex size-12 flex-none min-[430px]:order-3 items-center justify-center border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            aria-label="More options"
            data-testid="button-actionbar-more"
          >
            <MoreHorizontal className="size-5" strokeWidth={1.5} aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal container={container ?? undefined}>
            <DropdownMenu.Content
              side="top"
              align="end"
              sideOffset={8}
              className="z-[65] min-w-[200px] border border-border bg-background p-1 text-foreground shadow-xl"
              data-testid="actionbar-menu"
            >
              <DropdownMenu.Item
                onSelect={onNotInterested}
                className="flex min-h-12 cursor-pointer items-center px-4 text-[15px] outline-none data-[highlighted]:bg-secondary"
                data-testid="menu-not-interested"
              >
                Not interested
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={onShare}
                className="flex min-h-12 cursor-pointer items-center px-4 text-[15px] outline-none data-[highlighted]:bg-secondary"
                data-testid="menu-share"
              >
                Share this quote
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
  // Mounted on the themed wrapper, not inside the page: the page fades in with a transform, and a transformed
  // ancestor would make "fixed" mean "relative to the page" instead of the screen.
  return container ? createPortal(bar, container) : bar;
}
