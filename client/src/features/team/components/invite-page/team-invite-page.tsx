import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCurrentOrganization } from "@/features/organization/api/use-organization-queries";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { downloadTemplate } from "../../lib/csv-template";
import { lockRowsToBranch } from "../../lib/invite-rows";
import { readInviteFile } from "../../lib/parse-sheet";
import { useInviteDraftStore } from "../../state/invite-draft-store";
import { useInviteRows } from "../../state/use-invite-rows";
import { useTeamAccess } from "../../state/use-team-access";
import { RoleMatrixDialog } from "../dialogs/role-matrix-dialog";
import { TEAM_CARD } from "../shared/team-styles";
import { InviteRowsTable } from "./invite-rows-table";
import { SeatsSidebar } from "./seats-sidebar";
import { UploadDropzone } from "./upload-dropzone";

const TEAM_PATH = "/agency/team";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** /agency/team/invite: rows, CSV upload, template download and a seats sidebar. */
export function TeamInvitePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const access = useTeamAccess();
  const { data: org } = useCurrentOrganization();
  const [draft] = useState(() => useInviteDraftStore.getState().draft);
  const [notice, setNotice] = useState<string | null>(
    draft ? `Loaded ${plural(draft.rows.length, "person", "people")} from ${draft.fileName}. Check the rows, then send.` : null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [matrix, setMatrix] = useState(false);
  const form = useInviteRows(access.validation, draft?.rows ?? []);

  // The Teams page header handed the rows over; take them once.
  useEffect(() => {
    useInviteDraftStore.getState().setDraft(null);
  }, []);

  const ready = form.filled.length;
  const sentCount = form.filled.filter((r) => form.results[r.id]?.status === "sent").length;
  const toSend = ready - sentCount;
  // Referral partners do not use a seat.
  const seatsNeeded = form.filled.filter((r) => form.results[r.id]?.status !== "sent" && r.role !== "referral_agent").length;
  const commission = org?.homeworkerCommission;

  const loadFile = async (file: File) => {
    setUploadError(null);
    setNotice(null);
    try {
      const rows = lockRowsToBranch(await readInviteFile(file, access.branchOptions), access.lockedBranchId);
      if (!form.addUploaded(rows)) {
        setUploadError("That is more than 200 people. Split the list into smaller files.");
        return;
      }
      setNotice(`Loaded ${plural(rows.length, "person", "people")} from ${file.name}. Check the rows, then send.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "We couldn't read that file.");
    }
  };

  const send = async () => {
    const summary = await form.send();
    if (!summary) return;
    if (summary.failed === 0) {
      toast({ title: `${plural(summary.sent, "invite", "invites")} sent` });
      navigate(TEAM_PATH);
    } else {
      form.setBanner(`${plural(summary.sent, "invite", "invites")} sent, ${summary.failed} ${summary.failed === 1 ? "row needs" : "rows need"} attention. Fix the rows below and send again.`);
    }
  };

  if (!access.allowed) {
    return <p className="p-6 text-[14px] text-social-muted">Only admins and branch managers can invite people.</p>;
  }
  if (access.membersLoading) {
    return <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-social-muted" aria-label="Loading" />;
  }

  return (
    <div className="min-w-0 space-y-5 text-[14px] leading-[1.5]" data-testid="section-team-invite">
      <nav className="flex items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        <Link href={TEAM_PATH} className="inline-flex items-center gap-0.5 font-semibold text-social-orange-text hover:underline">
          <ChevronLeft className="h-3.5 w-3.5" />
          Teams &amp; Roles
        </Link>
        <span className="text-social-muted">/</span>
        <span className="text-social-muted">Invite people</span>
      </nav>
      <div>
        <h1 className="text-[22px] font-semibold leading-[1.2] xl:text-[24px]" data-testid="invite-title">
          Invite your team
        </h1>
        <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">
          Add everyone in one list. Pick a role and a branch for each person, or upload a spreadsheet.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className={cn(TEAM_CARD, "min-w-0 flex-[1_1_640px] p-5 xl:p-6")}>
          <UploadDropzone onFile={loadFile} onTemplate={() => downloadTemplate(access.branchOptions)} disabled={form.sending} />
          {notice && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-status-scheduled-fg" role="status" data-testid="upload-notice">
              <CheckCircle2 className="h-4 w-4" /> {notice}
            </p>
          )}
          {uploadError && (
            <p className="mt-2.5 text-[12px] text-status-failed-fg" role="alert" data-testid="upload-error">
              {uploadError}
            </p>
          )}

          <div className="mt-5">
            <InviteRowsTable
              rows={form.rows}
              errors={form.errors}
              results={form.results}
              branches={access.branchOptions}
              allowedRoles={access.allowedRoles}
              lockedBranchId={access.lockedBranchId}
              disabled={form.sending}
              onPatch={form.patchRow}
              onRole={form.setRole}
              onRemove={form.removeRow}
              onAdd={form.addRow}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-[12px]">
            <div>
              <div className="text-[13px] font-semibold">Homeworkers</div>
              <div className="text-social-muted">
                They earn the shared homeworker commission{typeof commission === "number" ? ` (${commission}%)` : ""} and have their own branch.
              </div>
            </div>
            {access.isAdmin && (
              <Link href="/agency/homeworkers" className="text-[13px] font-semibold text-social-orange-text hover:underline">
                Change rate
              </Link>
            )}
          </div>

          {form.banner && (
            <p className="mt-4 text-[13px] text-status-failed-fg" role="alert" data-testid="invite-banner">
              {form.banner}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-social-border pt-4">
            <span className="text-[12px] text-social-muted" data-testid="ready-count">
              {plural(ready, "invite", "invites")} ready
            </span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => navigate(TEAM_PATH)} disabled={form.sending}>
                Cancel
              </Button>
              <Button type="button" className={PRIMARY_ACTION} onClick={send} disabled={form.sending || toSend === 0} data-testid="button-send-invites">
                {form.sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {toSend > 0 ? `Send ${plural(toSend, "invite", "invites")}` : "Send invites"}
              </Button>
            </div>
          </div>
        </section>

        <div className="min-w-0 flex-[0_0_320px]">
          <SeatsSidebar adding={seatsNeeded} onMatrix={() => setMatrix(true)} />
        </div>
      </div>
      <RoleMatrixDialog open={matrix} onClose={() => setMatrix(false)} />
    </div>
  );
}
