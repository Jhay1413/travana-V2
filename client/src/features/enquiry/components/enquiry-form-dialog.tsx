import { useRef, useState, type ReactNode } from "react";
import { Phone } from "lucide-react";
import {
  Chips,
  Field,
  FormButton,
  FormCloseButton,
  FormFooter,
  FormHead,
  FormLinkButton,
  FormOverlay,
} from "@/components/shared/form-shell";
import { Checkbox } from "@/components/ui/checkbox";
import type { Enquiry } from "../types";
import {
  LEAD_SOURCES,
  holidayKind,
  validateEnquiryForm,
  type ChipKind,
  type EnquiryForm,
  type FieldKey,
  type FormErrors,
  type LeadSource,
} from "../lib/enquiry-form";
import type { EnquirySaveResult } from "../lib/enquiry-save-result";
import { buildEnquirySubmitData, type EnquirySubmitData } from "../lib/enquiry-submit-data";
import { summariseEnquiry } from "../lib/enquiry-summary";
import { uniqueOptionsByLabel } from "../lib/unique-options";
import { EnquiryWhereColumn } from "./enquiry-where-column";
import { EnquiryWhoColumn } from "./enquiry-who-column";
import { useEnquiryFormState, type EnquiryFormInit } from "./use-enquiry-form-state";

export interface EnquirySubmitOptions {
  /** True when the agent pressed "Save & start quote"; the caller should not navigate away. */
  startQuote: boolean;
  /** The full form (the inbox needs it for its own payload). */
  form: EnquiryForm;
}

/** Extras the inbox adds around the same form. */
export interface InboxFormOptions {
  init: EnquiryFormInit;
  title?: string;
  subtitle?: string;
  /** Linked-client card shown above the columns. */
  header?: ReactNode;
  renderChip: (kind: ChipKind) => ReactNode;
  /** Full-width band under the columns (chat quote, still needed, when you save). */
  renderBand: (ctx: { form: EnquiryForm; errors: FormErrors; showErrors: boolean }) => ReactNode;
  /** Label of the primary button; defaults to "Create enquiry". */
  primaryLabel?: string;
}

export interface EnquiryFormContentProps {
  /** Set to edit an existing enquiry. */
  enquiry?: Enquiry | null;
  inbox?: InboxFormOptions;
  onClose: () => void;
  /** Saves. May resolve to the created ids so "Save & start quote" can open the quote form. */
  onSubmit: (data: EnquirySubmitData, opts: EnquirySubmitOptions) => void | Promise<EnquirySaveResult | void>;
  isSaving: boolean;
  /** Called with the saved ids after "Save & start quote" (create and inbox only). */
  onStartQuote?: (result: EnquirySaveResult) => void;
}

export interface EnquiryFormDialogProps extends Omit<EnquiryFormContentProps, "onClose" | "inbox"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEAD_LABEL: Record<LeadSource, string> = {
  SHOP: "Shop",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  PHONE_ENQUIRY: "Phone enquiry",
};

const TITLE_PLACEHOLDER = {
  hottub: "e.g. Lake District Hot Tub Weekend",
  cruise: "e.g. Mediterranean Cruise",
  package: "e.g. Maldives Family Holiday",
} as const;

/** The pop-up's content (head, two columns, footer). Render inside a `FormOverlay`. */
export function EnquiryFormContent({ enquiry, inbox, onClose, onSubmit, isSaving, onStartQuote }: EnquiryFormContentProps) {
  const mode = inbox ? "inbox" : enquiry ? "edit" : "create";
  const strict = mode === "inbox";
  const api = useEnquiryFormState({ enquiry, init: inbox?.init });
  const { form, lookups } = api;
  const kind = holidayKind(form.holidayTypeName);
  const [showErrors, setShowErrors] = useState(false);
  const bodyRef = useRef<HTMLFormElement>(null);

  const allErrors = validateEnquiryForm(form, { strict });
  const errors: FormErrors = showErrors ? allErrors : {};
  const valid = Object.keys(allErrors).length === 0;
  const chip = (key: FieldKey): ReactNode => {
    const k = api.chipFor(key);
    return k && inbox ? inbox.renderChip(k) : undefined;
  };

  const submit = async (startQuote: boolean) => {
    if (isSaving) return;
    setShowErrors(true);
    if (!valid) {
      requestAnimationFrame(() => bodyRef.current?.querySelector(".fm-err")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    try {
      const result = await onSubmit(buildEnquirySubmitData(form), { startQuote, form });
      if (startQuote && result) onStartQuote?.(result);
    } catch {
      // The caller reports save failures (toast); the form stays open for another try.
    }
  };

  const title = inbox ? (inbox.title ?? "Create enquiry from this chat") : mode === "edit" ? "Edit enquiry" : "New enquiry";
  const subtitle = inbox
    ? inbox.subtitle
    : mode === "edit"
      ? "Update what the client is looking for."
      : "Take it down while you're on the call. Only a title and holiday type are needed to save.";
  const primaryLabel = isSaving ? "Saving..." : inbox ? (inbox.primaryLabel ?? "Create enquiry") : mode === "edit" ? "Save changes" : "Save enquiry";
  const columnProps = { api, errors, chip };

  return (
    <>
      <FormHead
        icon={<Phone size={22} color="#D97706" strokeWidth={1.8} aria-hidden="true" />}
        title={title}
        subtitle={subtitle}
        right={
          <>
            {mode === "create" && (
              <FormLinkButton
                onClick={() => {
                  api.reset();
                  setShowErrors(false);
                }}
                data-testid="button-clear-enquiry-form"
              >
                Clear form
              </FormLinkButton>
            )}
            <FormCloseButton onClick={() => !isSaving && onClose()} />
          </>
        }
      />

      <form ref={bodyRef} className="fm-enq__body" noValidate id="enq-form" onSubmit={(e) => e.preventDefault()}>
        {inbox?.header}

        <div className="fm-2">
          <Field label="Enquiry title" htmlFor="enq-title" chip={chip("title")} error={errors.title}>
            <input
              className="fm-input"
              id="enq-title"
              value={form.title}
              onChange={(e) => api.edit("title", { title: e.target.value })}
              placeholder={TITLE_PLACEHOLDER[kind]}
              aria-invalid={!!errors.title || undefined}
              autoComplete="off"
              data-testid="input-enquiry-title"
            />
          </Field>
          <Field label="Holiday type" chip={chip("holidayType")} error={errors.holidayType}>
            <Chips
              value={form.holidayType}
              onChange={(id) => {
                const name = lookups.packageTypes.find((p) => p.id === id)?.name ?? "";
                api.setHolidayType(id, name);
              }}
              options={uniqueOptionsByLabel(
                lookups.packageTypes.map((p) => ({ value: p.id, label: p.name })),
                [form.holidayType],
              )}
              data-testid="select-holiday-type"
              aria-label="Holiday type"
            />
          </Field>
        </div>

        {inbox && (
          <Field label="Lead source" chip={chip("leadSource")}>
            <Chips
              value={form.leadSource}
              onChange={(v) => api.edit("leadSource", { leadSource: LEAD_SOURCES.find((s) => s === v) ?? form.leadSource })}
              options={LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_LABEL[s] }))}
              data-testid="select-lead-source"
              aria-label="Lead source"
            />
          </Field>
        )}

        <div className="fm-enq__cols">
          <EnquiryWhereColumn kind={kind} {...columnProps} />
          <EnquiryWhoColumn kind={kind} {...columnProps} />
        </div>

        {inbox?.renderBand({ form, errors: allErrors, showErrors })}
      </form>

      <FormFooter
        status={
          <>
            <div className="fm-summary">
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#6B7686" }}>Summary</div>
              <p aria-live="polite" data-testid="text-enquiry-summary">
                {summariseEnquiry(form, lookups.labelOf)}
              </p>
              {!strict && !valid && (
                <p style={{ fontSize: 12, color: "#6B7686" }} data-testid="text-enquiry-hint">
                  Enter a title and holiday type to save.
                </p>
              )}
            </div>
            {!inbox && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500 }}>
                <Checkbox
                  checked={form.isTest}
                  onCheckedChange={(v) => api.patch({ isTest: v === true })}
                  className="h-5 w-5 rounded-md border-2 border-black/50 shadow-none data-[state=checked]:border-black/70 data-[state=checked]:bg-white data-[state=checked]:text-black/80"
                  data-testid="form-drawer-test-checkbox"
                />
                Test
              </label>
            )}
          </>
        }
      >
        <FormButton onClick={onClose} disabled={isSaving} data-testid="button-enquiry-cancel">
          Cancel
        </FormButton>
        {mode !== "edit" && onStartQuote && (
          <FormButton tone="navy" onClick={() => void submit(true)} disabled={isSaving || (!strict && !valid)} data-testid="button-save-start-quote">
            Save &amp; start quote
          </FormButton>
        )}
        <FormButton
          tone="primary"
          onClick={() => void submit(false)}
          disabled={isSaving || (!strict && !valid)}
          data-testid={inbox ? "button-create-enquiry" : "form-drawer-submit"}
        >
          {primaryLabel}
        </FormButton>
      </FormFooter>
    </>
  );
}

/** Centred pop-up for creating or editing an enquiry. Pass `enquiry` to edit. */
export function EnquiryFormDialog({ open, onOpenChange, ...rest }: EnquiryFormDialogProps) {
  if (!open) return null;
  return (
    <FormOverlay
      label={rest.enquiry ? "Edit enquiry" : "New enquiry"}
      onClose={() => onOpenChange(false)}
      preventClose={rest.isSaving}
      initialFocusId="enq-title"
      variant="enquiry"
      data-testid="enquiry-drawer"
    >
      <EnquiryFormContent {...rest} onClose={() => onOpenChange(false)} />
    </FormOverlay>
  );
}
