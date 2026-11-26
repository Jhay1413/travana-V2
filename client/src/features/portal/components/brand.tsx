import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { displayName, type PortalBranding } from "../api/portal-branding";
import { useRegisterPortalHero } from "./hero-context";

/** Small tracked uppercase label above a heading. */
export function Eyebrow({ children, className, as: Tag = "p" }: { children: ReactNode; className?: string; as?: "p" | "h2" | "div" | "span" }) {
  return <Tag className={cn("portal-eyebrow max-w-full [overflow-wrap:anywhere]", className)}>{children}</Tag>;
}

/** Serif heading with an italic second line: "Put together / for you." */
export function SplitHeading({
  lead,
  italic,
  as: Tag = "h2",
  className,
  id,
}: {
  lead: ReactNode;
  italic?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  id?: string;
}) {
  return (
    // A font-size class in `className` makes tailwind-merge drop the default line height, so it is re-applied
    // after the merge unless the caller chose its own.
    <Tag
      id={id}
      className={cn(
        "portal-serif max-w-full text-[38px] font-light leading-[1.08] text-primary [overflow-wrap:anywhere]",
        className,
        !className?.includes("leading-") && "leading-[1.08]",
      )}
    >
      {lead}
      {italic && (
        <>
          <br />
          <em className="italic">{italic}</em>
        </>
      )}
    </Tag>
  );
}

/**
 * The agency's mark, or its name in serif when it has no image. Never a fixed brand.
 * `mark` (header, menu, centred blocks) is the design's 48px-wide brand mark: the agency icon, else its logo.
 * `wordmark` (footer) is the design's 150px wordmark: the agency logo, else its icon.
 */
export function AgencyMark({
  branding,
  tone = "light",
  variant = "mark",
  className,
}: {
  branding: PortalBranding;
  /** `dark`: sits on navy, so an image is turned white and a name is white. */
  tone?: "light" | "dark";
  variant?: "mark" | "wordmark";
  className?: string;
}) {
  const name = displayName(branding);
  const src = variant === "wordmark" ? branding.logoUrl ?? branding.iconUrl : branding.iconUrl ?? branding.logoUrl;
  if (src) {
    const isIcon = src === branding.iconUrl;
    const size = variant === "wordmark" ? (isIcon ? "w-12" : "w-[150px]") : isIcon ? "w-12" : "max-w-[120px]";
    // On navy the image is turned white (the design's marks are white on navy), so any logo is visible there.
    const img = (
      <img
        src={src}
        alt={name}
        className={cn("block h-auto max-h-12 object-contain", size, tone === "dark" && "brightness-0 invert")}
        data-testid="portal-agency-logo"
      />
    );
    return <div className={cn("inline-flex", className)}>{img}</div>;
  }
  return (
    <span
      className={cn("portal-serif text-[26px] font-medium leading-none", tone === "dark" ? "text-white" : "text-primary", className)}
      data-testid="portal-agency-name"
    >
      {name}
    </span>
  );
}

/** The design's share glyph (box with an arrow out of the top), 16px, 1.5 stroke. */
export function ShareIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

/**
 * Full-bleed hero, as the reference's PhotoHero: 640px (600 from md) tall unless the screen sets its own height, the photo
 * filling it, the navy fade over it, the text centred at the bottom. With no photo it is the reference's plain #0D2A4E.
 * The floating header sits over its top edge.
 */
export function PortalHero({
  className,
  contentClassName,
  children,
  photoUrl,
}: {
  className?: string;
  /** Overrides of the text column's gap and bottom padding (each screen's own values in the design). */
  contentClassName?: string;
  children: ReactNode;
  photoUrl?: string;
}) {
  useRegisterPortalHero();
  return (
    <section className={cn("relative flex h-[640px] flex-col justify-end overflow-hidden bg-[#0D2A4E] text-white md:h-[600px]", className)}>
      {photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      <div aria-hidden className="portal-hero-fade absolute inset-0" />
      <div className={cn("relative mx-auto flex w-full min-w-0 max-w-xl flex-col items-center gap-[18px] px-7 pb-12 text-center", contentClassName)}>{children}</div>
    </section>
  );
}

/** Label / value rows in a hairline list. */
export function FactList({ items }: { items: { label: string; value: ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="border-b border-border">
      {items.map((f) => (
        <div key={f.label} className="flex flex-col gap-1.5 border-t border-border py-[18px]">
          <dt className="portal-caps-label">{f.label}</dt>
          <dd className={cn("portal-serif text-[22px] leading-tight text-primary", f.mono && "tracking-[0.08em]")}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Content column used under a hero. */
export function PortalSection({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("mx-auto w-full max-w-3xl px-7", className)} {...rest}>
      {children}
    </section>
  );
}

export type PortalButtonVariant = "amber" | "navy" | "outline" | "light" | "link";
export type PortalButtonSize = "default" | "sm" | "xs" | "lg";

// Uppercase, 12px, 0.28em tracking, square corners, 16px icons. Labels wrap rather than clip on narrow screens.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-none text-center text-xs uppercase leading-snug tracking-[0.28em] transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON_VARIANTS: Record<PortalButtonVariant, string> = {
  amber: "bg-accent font-medium text-accent-foreground hover:bg-[#E8873A]",
  navy: "bg-primary font-normal text-primary-foreground hover:brightness-110",
  outline: "border border-primary bg-transparent font-normal text-primary hover:bg-primary hover:text-primary-foreground",
  light: "border border-white/60 bg-transparent font-normal text-white",
  link: "px-0 font-normal text-primary hover:text-[hsl(var(--portal-amber-ink))]",
};

const BUTTON_SIZES: Record<PortalButtonSize, string> = {
  // Design .lx-btn: 52px tall, 0 30px. `sm` is its paired-button form (0 8px, 11px / 0.18em); `xs` the 48px card form; `lg` 56px.
  default: "min-h-[52px] px-[30px] py-2",
  sm: "min-h-[52px] px-2 py-2 text-[11px] tracking-[0.18em]",
  xs: "min-h-12 px-2 py-2 text-[11px] tracking-[0.18em]",
  lg: "min-h-14 px-[30px] py-2",
};

export function portalButtonClass(variant: PortalButtonVariant = "amber", className?: string, size: PortalButtonSize = "default"): string {
  // Link buttons are text only: h-11 with no horizontal padding, whatever the size.
  const sizeClass = variant === "link" ? "min-h-11 px-0" : BUTTON_SIZES[size];
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], sizeClass, className);
}

export function PortalButton({
  variant = "amber",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PortalButtonVariant; size?: PortalButtonSize }) {
  return <button type={type} className={portalButtonClass(variant, className, size)} {...props} />;
}
