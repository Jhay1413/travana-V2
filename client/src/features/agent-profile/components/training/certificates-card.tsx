import { Link } from "wouter";
import type { EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CardHead, CardNote, StatusPill } from "@/features/admin-dashboard";
import { EXPIRY_WARNING_DAYS, expiringDocuments } from "../../lib/documents-expiry";
import { tabPath } from "../../lib/profile-tabs";
import { EmptyBlock } from "../shared/profile-bits";

/** HR documents that carry an expiry date (accreditations, insurance, checks), soonest first. */
export function CertificatesCard({
  userId,
  employee,
  isLoading,
  isError,
  todayKey,
  className,
}: {
  userId: string;
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  todayKey: string;
  className?: string;
}) {
  const rows = expiringDocuments(employee?.documents ?? [], todayKey);

  return (
    <HomeCard className={className} testId="agent-profile-certificates">
      <CardHead id="certificates-title" title="Certificates and documents" />
      {isError ? (
        <CardNote tone="error" testId="certificates-error">
          We could not load the documents.
        </CardNote>
      ) : isLoading ? (
        <CardNote>Loading...</CardNote>
      ) : rows.length === 0 ? (
        <EmptyBlock title="None yet" testId="certificates-empty">
          None yet — documents with an expiry date will be listed here.
        </EmptyBlock>
      ) : (
        <ul className="m-0 list-none divide-y divide-social-border p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" data-testid={`certificate-${r.id}`}>
              <div className="min-w-0">
                <b className="block text-[14px] font-semibold">{r.name}</b>
                <span className="text-[12px] text-social-muted xl:text-[13px]">{r.text}</span>
              </div>
              <StatusPill tone={r.tone}>{r.pillLabel}</StatusPill>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3.5 text-[12px] text-social-muted xl:text-[13px]">
        Flagged {EXPIRY_WARNING_DAYS} days before they expire.{" "}
        <Link href={tabPath(userId, "hr")} className="font-semibold text-social-orange-text hover:underline" data-testid="link-manage-documents">
          Manage documents
        </Link>
      </p>
    </HomeCard>
  );
}
