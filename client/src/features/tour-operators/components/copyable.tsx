import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { tourOperatorsApi } from "../api/tour-operators.api";
import type { CopyApi } from "../state/use-copy-toast";
import type { OrgOperatorRow } from "../types";

export function Dash() {
  return <span className="text-social-muted">—</span>;
}

/** A value with a one-click copy button. Shows a dash when empty. */
export function Copyable({ label, value, mono, copy }: { label: string; value: string | null | undefined; mono?: boolean; copy: CopyApi["copy"] }) {
  if (!value) return <Dash />;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={cn(mono && "font-mono text-[13px]")}>{value}</span>
      <button
        type="button"
        onClick={() => void copy(label, value)}
        aria-label={`Copy ${label.toLowerCase()} ${label === "Password" ? "" : value}`.trim()}
        title={`Copy ${label.toLowerCase()}`}
        className="inline-grid h-6 w-6 place-items-center rounded-[8px] border border-transparent text-social-muted hover:border-social-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  );
}

/**
 * Writers see and copy the plain password. Read-only roles see a mask and a
 * "Copy password" button that fetches it from the reveal endpoint on click.
 */
export function PasswordCell({ row, canSeePasswords, copy, copyLater }: { row: OrgOperatorRow; canSeePasswords: boolean } & CopyApi) {
  if (canSeePasswords) return <Copyable label="Password" value={row.password} mono copy={copy} />;
  if (!row.hasPassword) return <Dash />;
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-label="Hidden password" className="font-mono tracking-widest">
        ••••••••
      </span>
      <button
        type="button"
        onClick={() => void copyLater("Password", () => tourOperatorsApi.revealPassword(row.linkId))}
        className="inline-flex items-center gap-1 rounded-[8px] border border-social-border px-2 py-1 text-[12px] font-semibold text-social-navy hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`copy-password-${row.linkId}`}
      >
        <Copy className="h-3 w-3" aria-hidden />
        Copy password
      </button>
    </span>
  );
}
