import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { PORTAL_PASSPORT_SEXES, type PortalPassenger } from "@shared/portal-passengers";
import { PortalApiError } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { readPassportPhoto, useCreatePortalPassenger, useSavePortalPassport } from "../../api/use-portal-passengers";
import { parsePassportDate, formatPassportDate, todayIso } from "../../lib/passport-dates";
import {
  EMPTY_PASSPORT_FORM,
  PASSPORT_FIELDS,
  checkBoxTone,
  formFromPassenger,
  formFromReadResult,
  previewPassportCheck,
  validatePassportForm,
  DATES_CHECK_HINT,
  type PassportFormErrors,
  type PassportFormField,
  type PassportFormValues,
  type PreviewTrip,
} from "../../lib/passport-form";
import { usePortalOverlayContainer } from "../../theme/PortalThemeProvider";
import { PortalButton } from "../brand";

export const STORAGE_NOTE = "Stored securely and only shared with your tour operator and the airline for this booking.";
const SAVE_FAILED = "We couldn't save that passport. Please try again.";

type Step = "camera" | "reading" | "unreadable" | "review";

const DATE_FIELDS: ReadonlyArray<PassportFormField> = ["dateOfBirth", "dateOfIssue", "expiryDate"];

/** The faint sample page behind the camera frame (the design's drawing). */
function GhostPassport({ slice = false }: { slice?: boolean }) {
  return (
    <svg viewBox="0 0 284 200" preserveAspectRatio={slice ? "xMidYMid slice" : "xMidYMid meet"} aria-hidden className="block size-full">
      <rect x="0" y="0" width="284" height="200" fill="#E9E1D3" />
      <rect x="16" y="14" width="90" height="8" fill="#B5AA97" />
      <rect x="16" y="36" width="66" height="84" fill="#B9AE9C" />
      <circle cx="49" cy="66" r="15" fill="#9C9180" />
      <path d="M24 120c4-20 46-20 50 0" fill="#9C9180" />
      <g fill="#A79D8B">
        <rect x="96" y="40" width="120" height="6" />
        <rect x="96" y="56" width="90" height="6" />
        <rect x="96" y="72" width="140" height="6" />
        <rect x="96" y="88" width="70" height="6" />
        <rect x="96" y="104" width="110" height="6" />
      </g>
      <g stroke="#6F675A" strokeWidth="8" strokeDasharray="6 3">
        <line x1="16" y1="156" x2="268" y2="156" />
        <line x1="16" y1="176" x2="268" y2="176" />
      </g>
    </svg>
  );
}

const CORNERS = [
  "-left-px -top-px border-l-2 border-t-2",
  "-right-px -top-px border-r-2 border-t-2",
  "-bottom-px -left-px border-b-2 border-l-2",
  "-bottom-px -right-px border-b-2 border-r-2",
];

const TIPS: ReadonlyArray<[string, string]> = [
  ["I", "Lay it flat, photo page up"],
  ["II", "All four corners inside the frame"],
  ["III", "No glare over the two lines of code at the bottom"],
];

function CloseButton({ tone }: { tone: "light" | "dark" }) {
  return (
    <DialogPrimitive.Close
      className={cn("inline-flex min-h-11 items-center justify-center p-0 text-[11px] font-normal uppercase tracking-[0.28em]", tone === "light" ? "text-white" : "text-primary")}
      data-testid="scanner-close"
    >
      Close
    </DialogPrimitive.Close>
  );
}

interface FieldProps {
  field: PassportFormField;
  label: string;
  value: string;
  error?: string;
  onChange: (field: PassportFormField, value: string) => void;
  onBlur: (field: PassportFormField) => void;
}

const FIELD_CLASS = "portal-serif block min-h-11 w-full rounded-none border-0 border-b border-input bg-transparent p-0 text-[21px] text-foreground aria-[invalid=true]:border-destructive";

function ReviewField({ field, label, value, error, onChange, onBlur }: FieldProps) {
  const base = useId();
  const id = `${base}-${field}`;
  const errorId = `${id}-error`;
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined, "data-testid": `scanner-field-${field}` } as const;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="portal-caps-label">
        {label}
      </label>
      {field === "sex" ? (
        <select {...common} className={FIELD_CLASS} value={value} onChange={(e) => onChange(field, e.target.value)}>
          <option value="">Not stated</option>
          {PORTAL_PASSPORT_SEXES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type="text"
          autoComplete="off"
          autoCapitalize={field === "passportNumber" ? "characters" : undefined}
          spellCheck={false}
          placeholder={DATE_FIELDS.includes(field) ? "22 Oct 2032" : undefined}
          className={FIELD_CLASS}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          onBlur={() => onBlur(field)}
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] portal-text-danger" data-testid={`scanner-error-${field}`}>
          {error}
        </p>
      )}
    </div>
  );
}

export interface PassportScannerProps {
  /** Who the passport is for: a listed traveller (the lead may have id "lead"), or null for a new traveller. */
  passenger: PortalPassenger | null;
  /** "LEAD PASSENGER" / "TRAVELLER 2": shown (in capitals) at the top. */
  whoLabel: string;
  /** The booking being shown, for the trip check before saving; null when it has already started. */
  trip: PreviewTrip | null;
  /** The agent's first name for the check sentence ("Sam will be in touch."). */
  agent: string;
  onClose: () => void;
  /** Called after a successful save, with the first name saved. */
  onSaved: (name: string) => void;
}

/**
 * The design's full-screen passport scanner: the camera step, "Reading your passport", and "Does this look right?".
 * Mounted only while open, so closing drops everything it held. The photo is never stored: it lives only as an object
 * URL for the preview, revoked on retake, save and close; the file input is cleared as soon as the file is taken.
 */
function ScannerBody({ passenger, whoLabel, trip, agent, onClose, onSaved }: PassportScannerProps) {
  const camId = useId();
  const upId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef(0);
  const [step, setStep] = useState<Step>("camera");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [readError, setReadError] = useState("");
  const [form, setForm] = useState<PassportFormValues>(EMPTY_PASSPORT_FORM);
  // The scanner has no trigger element, so Radix has nowhere to return focus: remember the opener and refocus it on close.
  const opener = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [errors, setErrors] = useState<PassportFormErrors>({});
  const [saveError, setSaveError] = useState("");
  const [read, setRead] = useState(false);
  const save = useSavePortalPassport();
  const create = useCreatePortalPassenger();
  const saving = save.isPending || create.isPending;

  // The preview URL is revoked whenever it is replaced and when the scanner closes.
  useEffect(() => {
    if (!photoUrl) return undefined;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  // A photo still being read when the scanner closes is ignored.
  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  // Each step's heading takes focus, so a screen reader and the keyboard follow the flow.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // never keep the chosen file in the input
    if (!file) return;
    const request = ++requestRef.current;
    setPhotoUrl(URL.createObjectURL(file));
    setReadError("");
    setStep("reading");
    readPassportPhoto(file).then(
      (result) => {
        if (request !== requestRef.current) return;
        setForm(formFromReadResult(result));
        setErrors({});
        setSaveError("");
        setRead(true);
        setStep("review");
      },
      (err: unknown) => {
        if (request !== requestRef.current) return;
        setReadError(err instanceof Error && err.message ? err.message : "We couldn't read that photo. Try again, or type the details in.");
        setStep("unreadable");
      },
    );
  };

  const typeInstead = () => {
    requestRef.current += 1;
    setPhotoUrl(null);
    setForm(passenger ? formFromPassenger(passenger) : EMPTY_PASSPORT_FORM);
    setErrors({});
    setSaveError("");
    setRead(false);
    setStep("review");
  };

  const retake = () => {
    requestRef.current += 1;
    setPhotoUrl(null);
    setForm(EMPTY_PASSPORT_FORM);
    setErrors({});
    setSaveError("");
    setRead(false);
    setStep("camera");
  };

  const change = (field: PassportFormField, value: string) => {
    setForm((f) => ({ ...f, [field]: field === "passportNumber" ? value.toUpperCase() : value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  // A date the customer typed is shown back the way the design writes it, so a misread is easy to spot.
  const blur = (field: PassportFormField) => {
    if (!DATE_FIELDS.includes(field)) return;
    const iso = parsePassportDate(form[field]);
    if (iso) setForm((f) => ({ ...f, [field]: formatPassportDate(iso) }));
  };

  const submit = async () => {
    if (saving) return;
    setSaveError("");
    const result = validatePassportForm(form, todayIso());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      if (passenger) await save.mutateAsync({ id: passenger.id, input: result.input });
      else await create.mutateAsync(result.input);
      onSaved(result.input.firstName);
    } catch (e) {
      setSaveError(e instanceof PortalApiError && e.message ? e.message : SAVE_FAILED);
    }
  };

  const expiryCheck = form.expiryDate.trim() ? previewPassportCheck(form.expiryDate, trip, agent, todayIso()) : null;
  const tone = expiryCheck ? checkBoxTone(expiryCheck.status) : checkBoxTone("warning");
  const dark = step !== "review";

  const heading = (children: ReactNode, className: string) => (
    <h2 ref={headingRef} tabIndex={-1} className={cn("portal-serif font-light focus:outline-none", className)}>
      {children}
    </h2>
  );

  return (
    <DialogPrimitive.Content
      aria-describedby={undefined}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (opener.current?.isConnected) opener.current.focus();
      }}
      className={cn("fixed inset-0 z-[90] overflow-y-auto focus:outline-none", dark ? "bg-[#001A3A] text-white" : "bg-background text-foreground")}
      data-testid="passport-scanner"
      data-step={step}
    >
      <DialogPrimitive.Title className="sr-only">Add a passport</DialogPrimitive.Title>

      {step === "camera" && (
        <div className="mx-auto box-border flex min-h-full w-full max-w-xl flex-col gap-[22px] px-6 pb-7 pt-4" data-testid="scanner-camera">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/70">{whoLabel}</span>
            <CloseButton tone="light" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="portal-eyebrow text-accent">Add a passport</div>
            {heading(
              <>
                The photo page,
                <br />
                <em className="italic">flat and clear.</em>
              </>,
              "text-[34px] leading-[1.08]",
            )}
          </div>
          <div className="relative aspect-[1.42] border border-white/[0.22] bg-white/[0.04]">
            <div aria-hidden className="absolute inset-3.5 opacity-30">
              <GhostPassport />
            </div>
            {CORNERS.map((c) => (
              <span key={c} aria-hidden className={cn("absolute size-7 border-accent", c)} />
            ))}
          </div>
          <ol>
            {TIPS.map(([numeral, text], i) => (
              <li key={numeral} className={cn("flex gap-4 border-t border-white/[0.14] py-3 text-sm leading-[1.5] text-white/[0.85]", i === TIPS.length - 1 && "border-b")}>
                <span className="portal-serif w-[22px] flex-none text-lg text-accent">{numeral}</span>
                {text}
              </li>
            ))}
          </ol>
          <div className="mt-auto flex flex-col items-center gap-3">
            <input id={camId} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="peer sr-only" data-testid="scanner-camera-input" />
            <label htmlFor={camId} className="flex cursor-pointer flex-col items-center gap-2.5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-accent">
              <span aria-hidden className="box-border flex size-[76px] items-center justify-center rounded-full border-[3px] border-white">
                <span className="size-[58px] rounded-full bg-accent" />
              </span>
              <span className="text-xs uppercase tracking-[0.28em]">Take photo</span>
            </label>
            <input id={upId} type="file" accept="image/*" onChange={onPhoto} className="peer sr-only" data-testid="scanner-upload-input" />
            <label htmlFor={upId} className="flex min-h-11 cursor-pointer items-center text-[11px] uppercase tracking-[0.2em] text-white/80 underline underline-offset-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-accent">
              Upload a photo instead
            </label>
            <button type="button" onClick={typeInstead} className="min-h-11 border-0 bg-transparent p-0 text-xs text-white/60" data-testid="scanner-type-instead">
              Type the details in instead
            </button>
          </div>
        </div>
      )}

      {step === "reading" && (
        <div className="mx-auto box-border flex min-h-full w-full max-w-xl flex-col justify-center gap-7 p-6 text-center" data-testid="scanner-reading">
          <div className="relative aspect-[1.42] overflow-hidden border border-white/[0.22]">
            {photoUrl ? <img src={photoUrl} alt="Your passport photo" className="block size-full object-cover" /> : <GhostPassport slice />}
            <span aria-hidden className="portal-scan-line absolute inset-x-0 top-[6%] h-0.5 bg-accent shadow-[0_0_18px_4px_rgba(222,118,33,0.55)]" />
          </div>
          <div role="status" className="flex flex-col items-center gap-2.5">
            <div className="portal-eyebrow text-accent">Reading your passport</div>
            {heading("Just a moment…", "text-2xl italic")}
            <p className="text-[13px] text-white/[0.72]">We&apos;re picking up the details from the photo page.</p>
          </div>
        </div>
      )}

      {step === "unreadable" && (
        <div className="mx-auto box-border flex min-h-full w-full max-w-xl flex-col gap-[22px] px-6 pb-7 pt-4" data-testid="scanner-unreadable">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/70">{whoLabel}</span>
            <CloseButton tone="light" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="portal-eyebrow text-accent">Add a passport</div>
            {heading(
              <>
                We couldn&apos;t
                <br />
                <em className="italic">read that.</em>
              </>,
              "text-[34px] leading-[1.08]",
            )}
          </div>
          <p role="alert" className="text-[15px] leading-[1.7] text-white/[0.85]" data-testid="scanner-read-error">
            {readError}
          </p>
          <div className="mt-auto flex flex-col gap-3">
            <PortalButton size="lg" onClick={typeInstead} data-testid="scanner-type-details">
              Type the details in
            </PortalButton>
            <PortalButton variant="light" onClick={retake} data-testid="scanner-try-another">
              Try another photo
            </PortalButton>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-[22px] px-6 pb-8 pt-4" data-testid="scanner-review">
          <div className="flex items-center justify-between">
            <span className="portal-caps-label">{whoLabel}</span>
            <CloseButton tone="dark" />
          </div>
          {read ? (
            <div className="flex items-center gap-4">
              <div className="aspect-[1.42] w-[104px] flex-none overflow-hidden border border-border bg-[#E9E1D3]">
                {photoUrl ? <img src={photoUrl} alt="Your passport photo" className="block size-full object-cover" /> : <GhostPassport slice />}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink">✓ Passport read</div>
                {heading(
                  <>
                    Does this
                    <br />
                    <em className="italic">look right?</em>
                  </>,
                  "text-[30px] leading-[1.05] text-primary",
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink">Add a passport</div>
              {heading(
                <>
                  Type the
                  <br />
                  <em className="italic">details in.</em>
                </>,
                "text-[30px] leading-[1.05] text-primary",
              )}
            </div>
          )}
          <p className="text-sm leading-[1.65] text-muted-foreground">
            {read
              ? "We've read these from your photo. Check each one against the passport and fix anything that's wrong."
              : "Copy each detail from the photo page of the passport. Write dates like 22 Oct 2032."}
          </p>
          {PASSPORT_FIELDS.map((f) => (
            <ReviewField key={f.key} field={f.key} label={f.label} value={form[f.key]} error={errors[f.key]} onChange={change} onBlur={blur} />
          ))}
          {expiryCheck ? (
            <div role="status" className="border px-[18px] py-4 text-sm leading-[1.6] text-foreground" style={{ background: tone.background, borderColor: tone.borderColor }} data-testid="scanner-check">
              {tone.prefix}
              {expiryCheck.text}
            </div>
          ) : (
            form.expiryDate.trim() && (
              <div role="status" className="border px-[18px] py-4 text-sm leading-[1.6] text-foreground" style={{ background: tone.background, borderColor: tone.borderColor }} data-testid="scanner-check">
                {DATES_CHECK_HINT}
              </div>
            )
          )}
          {saveError && (
            <p role="alert" className="text-[13px] portal-text-danger" data-testid="scanner-save-error">
              {saveError}
            </p>
          )}
          <PortalButton size="lg" className="w-full" onClick={() => void submit()} disabled={saving} data-testid="scanner-save">
            {saving ? "Saving…" : "Save passport"}
          </PortalButton>
          <PortalButton variant="outline" className="w-full" onClick={retake} disabled={saving} data-testid="scanner-retake">
            Retake photo
          </PortalButton>
          <p className="text-xs leading-[1.6] text-muted-foreground">{STORAGE_NOTE}</p>
        </div>
      )}
    </DialogPrimitive.Content>
  );
}

/** The scanner, mounted inside the themed wrapper (so it wears the portal's look). Renders nothing while closed. */
export function PassportScanner({ open, ...props }: PassportScannerProps & { open: boolean }) {
  const container = usePortalOverlayContainer();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && props.onClose()}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        {open && <ScannerBody {...props} />}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
