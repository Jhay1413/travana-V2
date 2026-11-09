// Tailwind class sets that give the shadcn controls inside the quote/booking form sections the
// look of the shared form shell (components/shared/form-shell). Pair with <FormSection>.

/** Field label above a control. */
export const fmLabelClass = "mb-1.5 block text-xs font-medium text-[#6B7686]";

/** Text / number / time inputs. */
export const fmInputClass =
  "h-[42px] rounded-[10px] border border-[#D5DCE6] bg-white px-3 text-sm font-medium text-[#1F2937] shadow-none placeholder:font-normal placeholder:text-[#9AA5B4] focus-visible:border-[#F59E0B] focus-visible:ring-[3px] focus-visible:ring-[#F59E0B]/35";

/** Button-shaped controls (select triggers, date pickers, comboboxes). */
export const fmControlClass =
  "h-[42px] rounded-[10px] border border-[#D5DCE6] bg-white px-3 text-sm font-medium text-[#1F2937] shadow-none hover:border-[#F59E0B] hover:bg-white focus-visible:border-[#F59E0B] focus-visible:ring-[3px] focus-visible:ring-[#F59E0B]/35";

/** Sub-heading inside a section (e.g. "Outbound" / "Inbound"). */
export const fmSubheadingClass = "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B45309]";

/** Small outlined action button inside a section. */
export const fmSmallButtonClass =
  "h-9 rounded-[10px] border border-[#E3E8EF] bg-white px-3.5 text-[13px] font-semibold text-[#1F2937] shadow-none hover:border-[#F59E0B] hover:bg-white";
