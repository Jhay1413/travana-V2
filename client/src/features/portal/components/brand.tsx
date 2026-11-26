import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { displayName, type PortalBranding } from "../api/portal-branding";

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

/** The agency's logo, or its name in serif when it has none. Never a fixed brand. */
export function AgencyMark({
  branding,
  tone = "light",
  className,
}: {
  branding: PortalBranding;
  /** `dark`: sits on navy, so a logo is placed on a plain white tile and a name is white. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const name = displayName(branding);
  if (branding.logoUrl) {
    const img = <img src={branding.logoUrl} alt={name} className="block h-9 w-auto max-w-[180px] object-contain" data-testid="portal-agency-logo" />;
    return tone === "dark" ? <div className={cn("inline-flex bg-white px-3 py-2", className)}>{img}</div> : <div className={cn("inline-flex", className)}>{img}</div>;
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

/** Full-bleed hero with the navy fade. A plain navy hero today; a photo can sit behind the fade later. */
export function PortalHero({
  className,
  children,
  photoUrl,
}: {
  className?: string;
  children: ReactNode;
  photoUrl?: string;
}) {
  return (
    <section className={cn("relative flex flex-col justify-end overflow-hidden bg-primary text-white", className)}>
      {photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      <div aria-hidden className="portal-hero-fade absolute inset-0" />
      <div className="relative mx-auto flex w-full min-w-0 max-w-xl flex-col items-center gap-[18px] px-7 pb-12 text-center">{children}</div>
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

const BUTTON_BASE =
  "inline-flex min-h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-none px-8 text-xs font-medium uppercase tracking-[0.24em] transition-colors disabled:pointer-events-none disabled:opacity-50";

const BUTTON_VARIANTS: Record<PortalButtonVariant, string> = {
  amber: "bg-accent text-accent-foreground hover:brightness-110",
  navy: "bg-primary text-primary-foreground hover:brightness-110",
  outline: "border border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground",
  light: "border border-white/70 bg-transparent text-white hover:bg-white/10",
  link: "min-h-11 px-0 text-primary hover:text-[hsl(var(--portal-amber-ink))]",
};

export function portalButtonClass(variant: PortalButtonVariant = "amber", className?: string): string {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className);
}

export function PortalButton({
  variant = "amber",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PortalButtonVariant }) {
  return <button type={type} className={portalButtonClass(variant, className)} {...props} />;
}
