import { useMemo, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { visibleBranches } from "../lib/branches";
import { validPerson } from "../lib/invite-plan";
import { flagOwnerEmail, ownerLabel } from "../lib/owner";
import { blankPerson, isBlankPerson, normaliseTeamRow, pasteIntoRows, updateRow } from "../lib/rows";
import { commissionSchema, makeTeamMemberSchema, type ShopChoice } from "../lib/schemas";
import { SheetError, readSheetFile, tableToPeople } from "../lib/sheet";
import { downloadOnboardingTemplate } from "../lib/templates";
import { validateObject, validateRows } from "../lib/validation";
import { inviteStanding } from "../lib/sent";
import { useOnboarding } from "../state/onboarding-context";
import { useSendPeople } from "../state/use-send-people";
import { PeopleTable } from "./people-table";
import { CARD_CLASS, ERROR_TEXT, INPUT_CLASS } from "./styles";
import { StepLayout } from "./step-layout";
import { UploadBox } from "./upload-box";
import { WizardFooter } from "./wizard-footer";

export function TeamStep() {
  const { state, server, patch, goto } = useOnboarding();
  const rows = state.team;
  const shops = useMemo<ShopChoice[]>(() => visibleBranches(server.branches).map((b) => ({ id: b.id, name: b.name })), [server.branches]);
  const { sendPeople, resultsFor, saveCommissionIfChanged, sending } = useSendPeople("team");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const results = useMemo(
    () =>
      flagOwnerEmail(
        rows,
        validateRows(rows.map(normaliseTeamRow), {
          schema: makeTeamMemberSchema(shops),
          isBlank: isBlankPerson,
          unique: [{ field: "email", message: "This email is already on another row." }],
        }),
        server.owner.email,
      ),
    [rows, shops, server.owner.email],
  );
  const errors = submitted ? Object.fromEntries(results.map((r) => [r.id, r.errors])) : {};
  const commissionError = validateObject(commissionSchema, state.commission).errors[""];

  async function handleFile(file: File) {
    setUploadError(null);
    setReading(true);
    try {
      const people = tableToPeople(await readSheetFile(file), { withShop: true, shops });
      patch({ review: { kind: "team", fileName: file.name, rows: people }, step: "team-review" });
    } catch (e) {
      setUploadError(e instanceof SheetError ? e.message : "We couldn't read that file. Save it as .csv and try again.");
    } finally {
      setReading(false);
    }
  }

  /** Skipping the invites still keeps a typed homeworker commission. */
  async function skip() {
    setFormError(null);
    const saveError = await saveCommissionIfChanged();
    if (saveError) {
      setFormError(saveError);
      return;
    }
    goto("done");
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
    if (filled.some((r) => !r.data) || commissionError) {
      setFormError(commissionError ?? "Fix the rows marked in red, or clear them to leave them out.");
      return;
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    const toSend = filled.filter(
      (r) => inviteStanding(byId.get(r.id)?.email ?? "", state.sentEmails, state.managerInvited) === null,
    );
    if (toSend.length === 0) {
      const saveError = await saveCommissionIfChanged();
      if (saveError) {
        setFormError(saveError);
        return;
      }
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
      title="Invite your team"
      subtitle="Pick a shop for each person. Set one commission % for all homeworkers."
    >
      <form noValidate onSubmit={onSubmit}>
        <div className={CARD_CLASS}>
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-social-orange/15 px-[18px] py-3.5">
            <div>
              <div id="commission-label" className="text-[14px] font-semibold">
                Homeworker commission
              </div>
              <div className="text-[12px] text-social-muted">
                {commissionError ? (
                  <span role="alert" className={ERROR_TEXT}>
                    {commissionError}
                  </span>
                ) : (
                  "One rate applies to all homeworkers. Leave blank to set it later."
                )}
              </div>
            </div>
            <div className="relative w-[140px] flex-none">
              <Input
                inputMode="numeric"
                aria-labelledby="commission-label"
                placeholder="e.g. 60"
                value={state.commission}
                aria-invalid={commissionError ? true : undefined}
                className={`${INPUT_CLASS} pr-8`}
                disabled={sending}
                onChange={(e) => patch({ commission: e.target.value })}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-0 flex h-11 items-center text-[13px] text-social-muted"
              >
                %
              </span>
            </div>
          </div>

          <UploadBox
            description="Upload a CSV file with first name, last name, email, shop and role, or drag and drop it here."
            onFile={handleFile}
            onDownloadTemplate={() => downloadOnboardingTemplate("team")}
            error={uploadError}
            busy={reading}
          />

          <PeopleTable
            rows={rows}
            withShop
            shops={shops}
            owner={ownerLabel(server.owner)}
            errors={errors}
            results={resultsFor(rows)}
            disabled={sending}
            onChange={(id, p) => patch({ team: updateRow(rows, id, p) })}
            onPasteRows={(start, incoming) => patch({ team: pasteIntoRows(rows, start, incoming) })}
            onAdd={() => patch({ team: [...rows, blankPerson()] })}
            addLabel="+ Add another person"
          />

          <WizardFooter
            onBack={() => goto("shops")}
            skipLabel="Skip for now"
            onSkip={() => void skip()}
            primaryLabel={sending ? "Sending…" : <>Send invites &rarr;</>}
            busy={sending}
            error={formError}
          />
        </div>
      </form>
    </StepLayout>
  );
}
