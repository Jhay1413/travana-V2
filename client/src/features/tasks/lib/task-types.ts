export const CUSTOM_TASK_TYPE = "custom";

export const TASK_TYPE_OPTIONS = [
  { value: "enquiry_call", label: "Enquiry call" },
  { value: "quote_call", label: "Quote call" },
  { value: "quote_follow_up", label: "Quote follow up" },
  { value: "re_quote", label: "Re-quote" },
  { value: "booking_call", label: "Booking call" },
  { value: "custom", label: "Custom" },
] as const;

export type TaskTypeValue = (typeof TASK_TYPE_OPTIONS)[number]["value"];

/** Option value whose label equals the title (trimmed, case-insensitive), else "custom". Hydrates the edit form. */
export function taskTypeForTitle(title: string | null | undefined): TaskTypeValue {
  const needle = (title ?? "").trim().toLowerCase();
  if (!needle) return CUSTOM_TASK_TYPE;
  const hit = TASK_TYPE_OPTIONS.find((o) => o.value !== CUSTOM_TASK_TYPE && o.label.toLowerCase() === needle);
  return hit ? hit.value : CUSTOM_TASK_TYPE;
}

/** The task title for a chosen type: the option label, or the trimmed free text for "custom". */
export function titleForTaskType(type: TaskTypeValue, customTitle: string): string {
  if (type === CUSTOM_TASK_TYPE) return customTitle.trim();
  return TASK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? customTitle.trim();
}
