import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { visibleBranches } from "../lib/branches";
import { validPerson } from "../lib/invite-plan";
import { flagOwnerEmail } from "../lib/owner";
import { isBlankPerson, isBlankShop, normaliseTeamRow, updateRow } from "../lib/rows";
import { HOMEWORKER_SHOP } from "../lib/roles";
import { agentSchema, makeTeamMemberSchema, shopSchema, type ShopChoice } from "../lib/schemas";
import { SheetError, readSheetFile, tableToPeople, tableToShops } from "../lib/sheet";
import { rowMessage, validateRows, type RowResult } from "../lib/validation";
import { useOnboarding } from "../state/onboarding-context";
import { useSendPeople } from "../state/use-send-people";
import type { PersonRow, ReviewState, ShopRow } from "../types";
import { OptionSelect } from "./option-select";
import { shopOptionsFor } from "./people-table";
import { ERROR_TEXT, LINK_BUTTON, MUTED_LINK_BUTTON, OUTLINE_BUTTON, PRIMARY_BUTTON, SMALL_INPUT_CLASS, CARD_CLASS } from "./styles";
import { ROLE_LABELS, ROLES } from "../lib/roles";
import { StepLayout } from "./step-layout";

interface Column {
  key: string;
  label: string;
  flex: number;
}

const COLUMNS: Record<ReviewState["kind"], Column[]> = {
  agents: [
    { key: "firstName", label: "First name", flex: 1 },
    { key: "lastName", label: "Last name", flex: 1 },
    { key: "email", label: "Email", flex: 1.8 },
    { key: "role", label: "Role", flex: 1.3 },
  ],
  team: [
    { key: "firstName", label: "First name", flex: 1 },
    { key: "lastName", label: "Last name", flex: 1 },
    { key: "email", label: "Email", flex: 1.6 },
    { key: "shop", label: "Shop", flex: 1.2 },
    { key: "role", label: "Role", flex: 1.3 },
  ],
  shops: [
    { key: "name", label: "Shop name", flex: 1 },
    { key: "address", label: "Address", flex: 1.8 },
    { key: "email", label: "Email", flex: 1.5 },
    { key: "phone", label: "Phone", flex: 1 },
    { key: "managerEmail", label: "Manager email", flex: 1.6 },
  ],
};

const ROLE_OPTIONS = ROLES.map((r) => ({ value: ROLE_LABELS[r], label: ROLE_LABELS[r] }));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Screen shown after a spreadsheet is uploaded: every row checked, fixable in place. */
export function ReviewStep() {
  const { state, goto } = useOnboarding();
  useEffect(() => {
    if (!state.review) goto("business");
  }, [state.review, goto]);
  if (!state.review) return null;
  return <ReviewScreen review={state.review} />;
}

function ReviewScreen({ review }: { review: ReviewState }) {
  const { state, server, patch } = useOnboarding();
  const fileInput = useRef<HTMLInputElement>(null);
  const { sendPeople, resultsFor, sending } = useSendPeople(review.kind === "team" ? "team" : "agents");
  const [error, setError] = useState<string | null>(null);

  const columns = COLUMNS[review.kind];
  const inviteResults = review.kind === "shops" ? {} : resultsFor(review.rows);
  const shops = useMemo<ShopChoice[]>(() => visibleBranches(server.branches).map((b) => ({ id: b.id, name: b.name })), [server.branches]);

  const results: RowResult<unknown>[] = useMemo(() => {
    if (review.kind === "shops") {
      return validateRows(review.rows, {
        schema: shopSchema,
        isBlank: isBlankShop,
        unique: [
          {
            field: "name",
            message: "A shop with this name is in the list already.",
            alsoTaken: [...visibleBranches(server.branches).map((b) => b.name), ...state.shops.filter((s) => !isBlankShop(s)).map((s) => s.name)],
          },
        ],
      });
    }
    const unique = [{ field: "email" as const, message: "This email is already on another row." }];
    const validated =
      review.kind === "team"
        ? validateRows(review.rows.map(normaliseTeamRow), { schema: makeTeamMemberSchema(shops), isBlank: isBlankPerson, unique })
        : validateRows(review.rows, { schema: agentSchema, isBlank: isBlankPerson, unique });
    return flagOwnerEmail(review.rows, validated, server.owner.email);
  }, [review, shops, state.shops, server.branches, server.owner.email]);

  const ready = results.filter((r) => r.data).length;
  const attention = results.filter((r) => !r.blank && !r.data).length;
  const total = review.rows.length;
  const noun = review.kind === "shops" ? plural(total, "shop", "shops") : plural(total, "person", "people");
  const title = review.kind === "shops" ? "Check your shops" : review.kind === "team" ? "Check your team" : "Check your agents";
  const origin = review.kind;

  function setRows(rows: PersonRow[] | ShopRow[], fileName = review.fileName) {
    patch({ review: { kind: review.kind, fileName, rows } as ReviewState });
  }

  function edit(id: string, key: string, value: string) {
    if (review.kind === "shops") setRows(updateRow(review.rows, id, { [key]: value }));
    else setRows(updateRow(review.rows, id, { [key]: value }));
  }

  function skipErrors() {
    const keep = new Set(results.filter((r) => r.blank || r.data).map((r) => r.id));
    if (review.kind === "shops") setRows(review.rows.filter((r) => keep.has(r.id)));
    else setRows(review.rows.filter((r) => keep.has(r.id)));
  }

  async function replaceFile(file: File) {
    setError(null);
    try {
      const table = await readSheetFile(file);
      if (review.kind === "shops") setRows(tableToShops(table), file.name);
      else setRows(tableToPeople(table, { withShop: review.kind === "team", shops }), file.name);
    } catch (e) {
      setError(e instanceof SheetError ? e.message : "We couldn't read that file. Save it as .csv and try again.");
    }
  }

  async function confirm() {
    if (ready === 0) return;
    setError(null);
    const okIds = new Set(results.filter((r) => r.data).map((r) => r.id));
    if (review.kind === "shops") {
      const added = review.rows.filter((r) => okIds.has(r.id));
      const existing = state.shops.filter((s) => !isBlankShop(s));
      // Shops are created for real when they leave the shops step; here we only add them to the list.
      patch({ shops: [...existing, ...added], activeShopId: "", review: null, step: "shops" });
      return;
    }
    const people = results.flatMap((r) => (r.data && inviteResults[r.id]?.status !== "sent" ? [validPerson(r.id, r.data as Parameters<typeof validPerson>[1])] : []));
    const outcome = await sendPeople(people);
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    if (outcome.failed > 0) {
      setError(`${outcome.failed} ${plural(outcome.failed, "invite", "invites")} couldn't be sent. See the rows marked in red.`);
      return;
    }
    patch({ review: null, step: "done" });
  }

  const primary =
    ready === 0
      ? "Nothing to add yet"
      : review.kind === "shops"
        ? `Add ${ready} ${plural(ready, "shop", "shops")}`
        : `Send ${ready} ${plural(ready, "invite", "invites")}`;

  return (
    <StepLayout
      wide
      title={title}
      subtitle={
        attention > 0
          ? `We found ${total} ${noun} in your file. Fix the rows marked in red or skip them.`
          : `We found ${total} ${noun} in your file. Everything looks good.`
      }
    >
      <div className={CARD_CLASS}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold">{review.fileName}</div>
            <div className="mt-2 flex gap-2.5" aria-live="polite">
              <Badge className="bg-status-posted-bg text-status-posted-fg">{ready} ready</Badge>
              {attention > 0 && <Badge className="bg-status-failed-bg text-status-failed-fg">{attention} need attention</Badge>}
            </div>
          </div>
          <button type="button" className={LINK_BUTTON} onClick={() => fileInput.current?.click()}>
            Replace file
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".csv,.tsv,.txt,text/csv"
            aria-label="Replace file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void replaceFile(file);
            }}
          />
        </div>

        <div className="max-md:overflow-x-auto max-md:pb-2">
          <div className="max-md:min-w-[900px]">
            <div className="mb-2.5 flex gap-3 pl-9" aria-hidden>
              {columns.map((c) => (
                <div key={c.key} className="text-[12px] font-medium text-social-muted" style={{ flex: c.flex }}>
                  {c.label}
                </div>
              ))}
            </div>

            <div role="group" aria-label={`Rows from ${review.fileName}`}>
              {review.rows.map((row, i) => {
                const result = results[i];
                const values = row as unknown as Record<string, string>;
                const sendResult = inviteResults[row.id];
                const message =
                  sendResult?.status === "error"
                    ? sendResult.message ?? "Couldn't send this invite."
                    : result
                      ? rowMessage(result.errors, columns.map((c) => c.key))
                      : null;
                const sent = sendResult?.status === "sent";
                const ok = Boolean(result?.data);
                const blank = Boolean(result?.blank);
                const homeworker = review.kind === "team" && values.shop === HOMEWORKER_SHOP;
                return (
                  <div key={row.id} className="mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        role="img"
                        aria-label={sent ? "Sent" : ok ? "Ready" : blank ? "Empty row" : "Needs attention"}
                        className={cn(
                          "flex size-6 flex-none items-center justify-center rounded-full text-[13px] font-semibold",
                          (ok || sent) && "bg-status-posted-fg text-white",
                          !ok && !blank && !sent && "bg-status-failed-bg text-status-failed-fg",
                          blank && "bg-social-border text-social-muted",
                        )}
                      >
                        {ok || sent ? "✓" : blank ? "–" : "!"}
                      </span>
                      {columns.map((c) => (
                        <div key={c.key} className="min-w-0" style={{ flex: c.flex }}>
                          {review.kind !== "shops" && c.key === "shop" ? (
                            <OptionSelect
                              aria-label={`${c.label}, row ${i + 1}`}
                              placeholder="Select shop"
                              value={values.shop ?? ""}
                              options={shopOptionsFor(shops)}
                              invalid={Boolean(result?.errors.shop)}
                              disabled={sending || sent}
                              onValueChange={(v) => edit(row.id, "shop", v)}
                            />
                          ) : review.kind !== "shops" && c.key === "role" ? (
                            <OptionSelect
                              aria-label={`${c.label}, row ${i + 1}`}
                              placeholder={homeworker ? "Homeworker" : "Select role"}
                              value={homeworker ? "" : (values.role ?? "")}
                              options={ROLE_OPTIONS}
                              invalid={Boolean(result?.errors.role)}
                              disabled={sending || sent || homeworker}
                              onValueChange={(v) => edit(row.id, "role", v)}
                            />
                          ) : (
                            <Input
                              aria-label={`${c.label}, row ${i + 1}`}
                              value={values[c.key] ?? ""}
                              disabled={sending || sent}
                              className={SMALL_INPUT_CLASS}
                              aria-invalid={result?.errors[c.key] || (c.key === "email" && sendResult?.status === "error") ? true : undefined}
                              onChange={(e) => edit(row.id, c.key, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {sent && sendResult?.message && (
                      <p className="ml-9 mt-1.5 text-[12px] text-status-posted-fg">{sendResult.message}</p>
                    )}
                    {message && (
                      <p role="alert" className={`${ERROR_TEXT} ml-9 mt-1.5`}>
                        {message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className={`${ERROR_TEXT} mt-3 text-right text-[13px]`}>
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            className={OUTLINE_BUTTON}
            disabled={sending}
            onClick={() => patch({ review: null, step: origin })}
          >
            &larr; Back
          </Button>
          <div className="flex items-center gap-5">
            {attention > 0 && (
              <button type="button" className={MUTED_LINK_BUTTON} disabled={sending} onClick={skipErrors}>
                Skip rows with errors
              </button>
            )}
            <Button type="button" className={PRIMARY_BUTTON} disabled={sending || ready === 0} onClick={() => void confirm()}>
              {sending ? (
                "Working…"
              ) : (
                <>
                  {primary}
                  {ready > 0 && <> &rarr;</>}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </StepLayout>
  );
}
