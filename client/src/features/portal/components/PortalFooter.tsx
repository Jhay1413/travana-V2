import type { PortalBranding } from "../api/portal-branding";
import { AgencyMark } from "./brand";

/**
 * The reference footer: navy-deep, centred column, the logo (white), a row of 11px caps links (here the agency's phone and
 * email, there being no Help / Privacy / Terms pages) and one line of company details. Everything comes from the agency's own data;
 * fields it has not entered are simply left out.
 */
export function PortalFooter({ branding }: { branding: PortalBranding }) {
  const licences = [branding.atol ? `ATOL ${stripPrefix(branding.atol, "ATOL")}` : null, branding.abta ? `ABTA ${stripPrefix(branding.abta, "ABTA")}` : null].filter(
    (v): v is string => v !== null,
  );
  const details = [branding.name, branding.address, ...licences].filter((v): v is string => !!v);
  return (
    <footer className="portal-bg-navy-deep flex flex-col items-center gap-[22px] px-7 pb-12 pt-14 text-center text-xs leading-[1.7] text-white/60" data-testid="portal-footer">
      <AgencyMark branding={branding} tone="dark" variant="wordmark" />
      {(branding.phone || branding.email) && (
        <div className="flex flex-wrap justify-center gap-x-[22px] gap-y-1 text-[11px] uppercase tracking-[0.2em]">
          {branding.phone && (
            <a href={`tel:${branding.phone.replace(/[^\d+]/g, "")}`} className="text-white no-underline">
              {branding.phone}
            </a>
          )}
          {branding.email && (
            <a href={`mailto:${branding.email}`} className="text-white no-underline [overflow-wrap:anywhere]">
              {branding.email}
            </a>
          )}
        </div>
      )}
      {details.length > 0 && <p className="max-w-full [overflow-wrap:anywhere]">{details.join(" · ")}</p>}
    </footer>
  );
}

/** "ATOL 1234" typed in full is shown once, not as "ATOL ATOL 1234". */
export function stripPrefix(value: string, prefix: string): string {
  const trimmed = value.trim();
  return trimmed.toUpperCase().startsWith(prefix) ? trimmed.slice(prefix.length).trim() || trimmed : trimmed;
}
