import type { ClipboardEvent } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { HOMEWORKER_LABEL, HOMEWORKER_SHOP, ROLE_LABELS, ROLES } from "../lib/roles";
import type { ShopChoice } from "../lib/schemas";
import { parsePasted, tableToPeople, type Table } from "../lib/sheet";
import { rowMessage, type FieldErrors } from "../lib/validation";
import type { InviteResult, PersonRow } from "../types";
import { OptionSelect, type Option } from "./option-select";
import { ERROR_TEXT, LINK_BUTTON, SMALL_INPUT_CLASS } from "./styles";

const ROLE_OPTIONS: Option[] = ROLES.map((r) => ({ value: ROLE_LABELS[r], label: ROLE_LABELS[r] }));
const ERROR_ORDER = ["firstName", "lastName", "email", "shop", "role"];

export function shopOptionsFor(shops: ShopChoice[]): Option[] {
  return [...shops.map((s) => ({ value: s.id, label: s.name })), { value: HOMEWORKER_SHOP, label: HOMEWORKER_LABEL }];
}

interface OwnerRow {
  name: string;
  email: string;
}

interface PeopleTableProps {
  rows: PersonRow[];
  /** Multi-shop teams pick a shop (or Homeworker) for each person. */
  withShop: boolean;
  shops?: ShopChoice[];
  /** The signed-in owner, shown first and locked. Never sent as an invite. */
  owner: OwnerRow | null;
  /** Errors by row id. Pass an empty object to hide them. */
  errors: Record<string, FieldErrors>;
  /** Per-row invite outcome, keyed by row id. */
  results?: Record<string, InviteResult>;
  disabled?: boolean;
  onChange: (id: string, patch: Partial<PersonRow>) => void;
  onPasteRows: (startIndex: number, rows: PersonRow[]) => void;
  onAdd: () => void;
  addLabel: string;
}

/** The editable people table used by the single-shop invite step and the multi-shop team step. */
export function PeopleTable({
  rows,
  withShop,
  shops = [],
  owner,
  errors,
  results = {},
  disabled,
  onChange,
  onPasteRows,
  onAdd,
  addLabel,
}: PeopleTableProps) {
  const cols = withShop
    ? { first: 1, last: 1, email: 1.6, shop: 1.15, role: 1.25 }
    : { first: 1, last: 1, email: 1.8, shop: 0, role: 1.4 };
  const shopOptions = shopOptionsFor(shops);

  function paste(e: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return; // one value: paste normally
    e.preventDefault();
    const table: Table = parsePasted(text);
    onPasteRows(index, tableToPeople(table, { withShop, shops }));
  }

  const headerCell = "text-[12px] font-medium text-social-muted";

  return (
    <div role="group" aria-label="People to invite" className="max-md:overflow-x-auto max-md:pb-2">
      <div className="max-md:min-w-[780px]">
        <div className="mb-2.5 flex gap-3 pl-8" aria-hidden>
          <div className={headerCell} style={{ flex: cols.first }}>First name</div>
          <div className={headerCell} style={{ flex: cols.last }}>Last name</div>
          <div className={headerCell} style={{ flex: cols.email }}>Email</div>
          {withShop && <div className={headerCell} style={{ flex: cols.shop }}>Shop</div>}
          <div className={headerCell} style={{ flex: cols.role }}>Role</div>
        </div>

        {owner && (
          <div className="mb-2.5 flex items-center gap-3" data-testid="owner-row">
            <span className="w-5 flex-none" />
            <div
              className="flex h-10 min-w-0 items-center gap-2 rounded-[10px] border border-social-border bg-social-page px-3 text-[13px] text-social-muted"
              style={{ flex: cols.first + cols.last + cols.email + cols.shop + cols.role }}
            >
              <span className="truncate font-semibold text-foreground">{owner.name || "You"}</span>
              <span className="truncate">{owner.email}</span>
              <span className="ml-auto flex-none rounded-full bg-social-navy px-2.5 py-0.5 text-[11px] font-semibold text-white">
                You · Owner/Admin
              </span>
            </div>
          </div>
        )}

        {rows.map((row, i) => {
          const rowErrors = errors[row.id] ?? {};
          const result = results[row.id];
          const sent = result?.status === "sent";
          const message =
            result?.status === "error" ? (result.message ?? "Couldn't send this invite.") : rowMessage(rowErrors, ERROR_ORDER);
          const n = i + 1;
          const isHomeworker = withShop && row.shop === HOMEWORKER_SHOP;
          const locked = disabled || sent;
          return (
            <div key={row.id}>
              <div className="mb-2.5 flex items-center gap-3">
                <span className="grid w-5 flex-none place-items-center text-[12px] text-social-muted">
                  {sent ? <Check className="size-4 text-status-posted-fg" aria-label="Invite sent" /> : n}
                </span>
                <div className="min-w-0" style={{ flex: cols.first }}>
                  <Input
                    aria-label={`First name, person ${n}`}
                    placeholder="First name"
                    value={row.firstName}
                    disabled={locked}
                    className={SMALL_INPUT_CLASS}
                    aria-invalid={rowErrors.firstName ? true : undefined}
                    onChange={(e) => onChange(row.id, { firstName: e.target.value })}
                    onPaste={(e) => paste(e, i)}
                  />
                </div>
                <div className="min-w-0" style={{ flex: cols.last }}>
                  <Input
                    aria-label={`Last name, person ${n}`}
                    placeholder="Last name"
                    value={row.lastName}
                    disabled={locked}
                    className={SMALL_INPUT_CLASS}
                    aria-invalid={rowErrors.lastName ? true : undefined}
                    onChange={(e) => onChange(row.id, { lastName: e.target.value })}
                    onPaste={(e) => paste(e, i)}
                  />
                </div>
                <div className="min-w-0" style={{ flex: cols.email }}>
                  <Input
                    type="email"
                    aria-label={`Email address, person ${n}`}
                    placeholder="Email address"
                    value={row.email}
                    disabled={locked}
                    className={SMALL_INPUT_CLASS}
                    aria-invalid={rowErrors.email || result?.status === "error" ? true : undefined}
                    onChange={(e) => onChange(row.id, { email: e.target.value })}
                    onPaste={(e) => paste(e, i)}
                  />
                </div>
                {withShop && (
                  <div className="min-w-0" style={{ flex: cols.shop }}>
                    <OptionSelect
                      aria-label={`Shop, person ${n}`}
                      placeholder="Select shop"
                      value={row.shop}
                      options={shopOptions}
                      invalid={Boolean(rowErrors.shop)}
                      disabled={locked}
                      onValueChange={(shop) => onChange(row.id, { shop })}
                    />
                  </div>
                )}
                <div className="min-w-0" style={{ flex: cols.role }}>
                  <OptionSelect
                    aria-label={`Role, person ${n}`}
                    placeholder={isHomeworker ? "Homeworker" : "Select role"}
                    value={isHomeworker ? "" : row.role}
                    options={ROLE_OPTIONS}
                    invalid={Boolean(rowErrors.role) && !isHomeworker}
                    disabled={locked || isHomeworker}
                    onValueChange={(role) => onChange(row.id, { role })}
                  />
                </div>
              </div>
              {sent && result?.message && (
                <p className="-mt-1 mb-2.5 ml-8 text-[12px] text-status-posted-fg">{result.message}</p>
              )}
              {message && (
                <p role="alert" className={`${ERROR_TEXT} -mt-1 mb-2.5 ml-8`}>
                  {message}
                </p>
              )}
            </div>
          );
        })}

        <button type="button" onClick={onAdd} disabled={disabled} className={`${LINK_BUTTON} ml-8`}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}
