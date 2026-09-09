import { useId, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Right-hand "Create / Edit" drawer used by the quote, booking and enquiry
 * edit flows on the client dashboard. One teal header bar, full-bleed teal
 * section bars, grey-filled fields, and a Test + Save footer.
 *
 * Field styling helpers (`drawerLabelClass`, `drawerInputClass`,
 * `drawerControlClass`) are exported so the forms rendered inside can match
 * the drawer without the drawer knowing about their internals.
 */

// ─── Shared classes ─────────────────────────────────────────────────────────

/** Teal gradient shared by the header and every section bar. */
export const drawerBarClass = "bg-gradient-to-r from-[#19b2c9] to-[#26cfb3] text-white";

/** Field label above an input. */
export const drawerLabelClass = "text-sm font-normal text-black/60";

/** Text / number inputs. */
export const drawerInputClass =
  "h-11 rounded-md border border-black/[0.08] bg-[#f4f5f7] px-3 text-sm text-black/80 shadow-none placeholder:text-black/35 focus-visible:ring-1 focus-visible:ring-[#26cfb3]";

/** Button-shaped controls (select triggers, date pickers, comboboxes). */
export const drawerControlClass =
  "h-11 rounded-md border border-black/[0.08] bg-[#f4f5f7] px-3 text-sm font-normal text-black/80 shadow-none hover:bg-[#eef0f3] focus-visible:ring-1 focus-visible:ring-[#26cfb3]";

/** Sub-heading inside a section (e.g. "Outbound" / "Inbound"). */
export const drawerSubheadingClass = "flex items-center gap-2 text-[15px] font-medium text-black/80";

// ─── Drawer shell ───────────────────────────────────────────────────────────

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Screen-reader description; not rendered visually. */
  description?: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  "data-testid": testId,
}: FormDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideClose
        overlayClassName="bg-black/25"
        className={cn(
          "flex w-full flex-col gap-0 border-0 bg-white p-0 shadow-2xl sm:max-w-[780px]",
          className,
        )}
        data-testid={testId}
      >
        <div className={cn("flex h-20 shrink-0 items-center justify-between px-6", drawerBarClass)}>
          <SheetTitle className="text-xl font-semibold text-white">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="sr-only">{description}</SheetDescription>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-10 w-10 place-items-center rounded-md text-white/90 transition hover:bg-white/15 hover:text-white"
            aria-label="Close"
            data-testid="form-drawer-close"
          >
            <X className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

interface FormDrawerSectionProps {
  title: ReactNode;
  children: ReactNode;
  /** Start collapsed — used for optional sections that have no data yet. */
  defaultOpen?: boolean;
  /**
   * Set false to always keep the section mounted (no X). Use for sections
   * whose children run effects the rest of the form depends on.
   */
  collapsible?: boolean;
  /** Extra classes for the content area (defaults to px-7 py-5). */
  contentClassName?: string;
  "data-testid"?: string;
}

/**
 * Full-bleed teal bar with the section title on the left and an X on the
 * right. The X collapses the section (it never discards data); a collapsed
 * bar shows a + to reopen it.
 */
export function FormDrawerSection({
  title,
  children,
  defaultOpen = true,
  collapsible = true,
  contentClassName,
  "data-testid": testId,
}: FormDrawerSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const open = collapsible ? isOpen : true;

  return (
    <section data-testid={testId} data-state={open ? "open" : "closed"}>
      <div className={cn("flex items-center justify-between px-7 py-1.5", drawerBarClass)}>
        <span className="truncate text-[13px] font-semibold">{title}</span>
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="ml-3 grid h-5 w-5 shrink-0 place-items-center rounded text-white/90 transition hover:bg-white/20 hover:text-white"
            aria-label={open ? "Collapse section" : "Expand section"}
            aria-expanded={open}
            aria-controls={contentId}
          >
            {open ? <X className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
          </button>
        )}
      </div>
      {open && (
        <div id={contentId} className={cn("px-7 py-5", contentClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Plain field (non-RHF forms) ────────────────────────────────────────────

interface DrawerFieldProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label-above-control wrapper for forms that don't use react-hook-form. */
export function DrawerField({ label, children, className }: DrawerFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className={cn("block", drawerLabelClass)}>{label}</span>
      {children}
    </div>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

interface FormDrawerFooterProps {
  /** Value of the "Test" checkbox; omit to hide the checkbox. */
  isTest?: boolean;
  onTestChange?: (checked: boolean) => void;
  testLabel?: string;
  submitLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  /** Omit to submit the surrounding <form>. */
  onSubmit?: () => void;
  /** Short note shown left of the controls, e.g. why Save is disabled. */
  hint?: ReactNode;
  /** Extra controls rendered before the Test checkbox. */
  children?: ReactNode;
  "data-testid"?: string;
}

/** A labelled square checkbox in the footer's style. */
export function FormDrawerCheckbox({
  label,
  checked,
  onCheckedChange,
  "data-testid": testId,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "data-testid"?: string;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-1.5">
      <span className={cn("whitespace-nowrap", drawerLabelClass)}>{label}</span>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="h-6 w-6 rounded-md border-2 border-black/50 shadow-none data-[state=checked]:border-black/70 data-[state=checked]:bg-white data-[state=checked]:text-black/80"
        data-testid={testId}
      />
    </label>
  );
}

export function FormDrawerFooter({
  isTest,
  onTestChange,
  testLabel = "Test",
  submitLabel = "Save Changes",
  isLoading = false,
  disabled = false,
  onSubmit,
  hint,
  children,
  "data-testid": testId,
}: FormDrawerFooterProps) {
  return (
    <div className="flex items-end justify-end gap-8 px-7 pb-8 pt-4" data-testid={testId}>
      {hint && <span className="mr-auto self-center text-xs text-black/45">{hint}</span>}
      {children}
      {onTestChange && (
        <FormDrawerCheckbox
          label={testLabel}
          checked={!!isTest}
          onCheckedChange={onTestChange}
          data-testid="form-drawer-test-checkbox"
        />
      )}
      <button
        type={onSubmit ? "button" : "submit"}
        onClick={onSubmit}
        disabled={isLoading || disabled}
        className="h-11 rounded-md bg-[#dbeafe] px-6 text-sm font-medium text-[#8b7cf6] transition hover:bg-[#cfe2fb] disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="form-drawer-submit"
      >
        {isLoading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
