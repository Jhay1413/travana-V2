import { useMemo, useState, type FormEvent } from "react";
import { validPerson } from "../lib/invite-plan";
import { blankPerson, isBlankPerson, pasteIntoRows, updateRow } from "../lib/rows";
import { agentSchema } from "../lib/schemas";
import { SheetError, readSheetFile, tableToPeople } from "../lib/sheet";
import { downloadOnboardingTemplate } from "../lib/templates";
import { validateRows } from "../lib/validation";
import { inviteStanding } from "../lib/sent";
import { useOnboarding } from "../state/onboarding-context";
import { useSendPeople } from "../state/use-send-people";
import { flagOwnerEmail, ownerLabel } from "../lib/owner";
import { PeopleTable } from "./people-table";
import { CARD_CLASS } from "./styles";
import { StepLayout } from "./step-layout";
import { UploadBox } from "./upload-box";
import { WizardFooter } from "./wizard-footer";

export function AgentsStep() {
  const { state, server, patch, goto } = useOnboarding();
  const rows = state.agents;
  const { sendPeople, resultsFor, sending } = useSendPeople("agents");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const results = useMemo(
    () =>
      flagOwnerEmail(
        rows,
        validateRows(rows, {
          schema: agentSchema,
          isBlank: isBlankPerson,
          unique: [{ field: "email", message: "This email is already on another row." }],
        }),
        server.owner.email,
      ),
    [rows, server.owner.email],
  );
  const errors = submitted ? Object.fromEntries(results.map((r) => [r.id, r.errors])) : {};
  const count = Number(state.business.agentCount) || rows.length;

  async function handleFile(file: File) {
    setUploadError(null);
    setReading(true);
    try {
      const people = tableToPeople(await readSheetFile(file), { withShop: false, shops: [] });
      patch({ review: { kind: "agents", fileName: file.name, rows: people }, step: "agents-review" });
    } catch (e) {
      setUploadError(e instanceof SheetError ? e.message : "We couldn't read that file. Save it as .csv and try again.");
    } finally {
      setReading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    const filled = results.filter((r) => !r.blank);
    if (filled.length === 0) {
      setFormError("Add at least one person, or skip for now.");
      return;
    }
    if (filled.some((r) => !r.data)) {
      setFormError("Fix the rows marked in red, or clear them to leave them out.");
      return;
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    const toSend = filled.filter(
      (r) => inviteStanding(byId.get(r.id)?.email ?? "", state.sentEmails, state.managerInvited) === null,
    );
    if (toSend.length === 0) {
      goto("done");
      return;
    }
    const outcome = await sendPeople(toSend.flatMap((r) => (r.data ? [validPerson(r.id, r.data)] : [])));
    if (outcome.error) {
      setFormError(outcome.error);
      return;
    }
    if (outcome.failed > 0) {
      setFormError(`${outcome.failed} ${outcome.failed === 1 ? "invite" : "invites"} couldn't be sent. See the rows marked in red.`);
      return;
    }
    goto("done");
  }

  return (
    <StepLayout
      wide
      title="Invite your agents"
      subtitle="Add the people who'll use Travana. They'll each receive a login invite."
    >
      <form noValidate onSubmit={onSubmit}>
        <div className={CARD_CLASS}>
          <p className="mb-5 mt-0 text-[13px] text-social-muted">
            {count} spaces based on your answer{state.business.hasBranchManager ? ", plus a Branch Manager" : ""}. Add more any time.
            You can paste rows straight from Excel or Google Sheets.
          </p>
          <UploadBox
            description="Upload a CSV file with first name, last name, email and role, or drag and drop it here."
            onFile={handleFile}
            onDownloadTemplate={() => downloadOnboardingTemplate("agents")}
            error={uploadError}
            busy={reading}
          />
          <PeopleTable
            rows={rows}
            withShop={false}
            owner={ownerLabel(server.owner)}
            errors={errors}
            results={resultsFor(rows)}
            disabled={sending}
            onChange={(id, p) => patch({ agents: updateRow(rows, id, p) })}
            onPasteRows={(start, incoming) => patch({ agents: pasteIntoRows(rows, start, incoming) })}
            onAdd={() => patch({ agents: [...rows, blankPerson()] })}
            addLabel="+ Add another agent"
          />
          <WizardFooter
            onBack={() => goto("business")}
            skipLabel="Skip for now"
            onSkip={() => goto("done")}
            primaryLabel={sending ? "Sending…" : <>Send invites &rarr;</>}
            busy={sending}
            error={formError}
          />
        </div>
      </form>
    </StepLayout>
  );
}
