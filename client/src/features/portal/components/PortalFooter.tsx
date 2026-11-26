import type { PortalBranding } from "../api/portal-branding";
import { AgencyMark } from "./brand";

/** Everything here comes from the agency's own data; fields it has not entered are simply left out. */
export function PortalFooter({ branding }: { branding: PortalBranding }) {
  const licences = [branding.atol ? `ATOL ${stripPrefix(branding.atol, "ATOL")}` : null, branding.abta ? `ABTA ${stripPrefix(branding.abta, "ABTA")}` : null].filter(
    (v): v is string => v !== null,
  );
  return (
    <footer className="portal-bg-navy-deep flex flex-col items-center gap-5 px-7 pb-10 pt-12 text-center text-[13px] leading-relaxed text-white/80" data-testid="portal-footer">
      <AgencyMark branding={branding} tone="dark" />
      {branding.logoUrl && branding.name && <p className="portal-serif text-[22px] text-white">{branding.name}</p>}
      {(branding.phone || branding.email) && (
        <p className="flex flex-col items-center gap-1">
          {branding.phone && (
            <a href={`tel:${branding.phone.replace(/[^\d+]/g, "")}`} className="text-white underline-offset-4 hover:underline">
              {branding.phone}
            </a>
          )}
          {branding.email && (
            <a href={`mailto:${branding.email}`} className="text-white underline-offset-4 hover:underline">
              {branding.email}
            </a>
          )}
        </p>
      )}
      {branding.address && <p className="max-w-xs">{branding.address}</p>}
      {licences.length > 0 && <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/75">{licences.join(" · ")}</p>}
    </footer>
  );
}

/** "ATOL 1234" typed in full is shown once, not as "ATOL ATOL 1234". */
export function stripPrefix(value: string, prefix: string): string {
  const trimmed = value.trim();
  return trimmed.toUpperCase().startsWith(prefix) ? trimmed.slice(prefix.length).trim() || trimmed : trimmed;
}
