export interface BuiltScheduleForm {
  fields: Record<string, string>;
  files: File[];
}

interface BaseInput {
  /** UTC ISO of the chosen time. */
  utcIso: string;
  /** Local "YYYY-MM-DDTHH:mm" of the chosen time. */
  local: string;
  files?: File[];
}

export type ScheduleFormInput =
  | (BaseInput & { kind: "schedule"; imageUrls: string[] })
  | (BaseInput & { kind: "reschedule"; postContent: string; existingImageIds: (string | number)[] });

/**
 * Fields for the schedule / reschedule request. `postContent` is only sent on reschedule:
 * a first schedule never overwrites the saved text.
 */
export function buildScheduleForm(input: ScheduleFormInput): BuiltScheduleForm {
  const fields: Record<string, string> = {
    postSchedule: input.utcIso,
    postScheduleLocal: input.local,
  };
  if (input.kind === "reschedule") {
    fields.postContent = input.postContent;
    fields.existingImageIds = JSON.stringify(input.existingImageIds);
    fields.imageUrls = "[]";
  } else {
    fields.existingImageIds = "[]";
    fields.imageUrls = JSON.stringify(input.imageUrls);
  }
  return { fields, files: input.files ?? [] };
}

export function toFormData(form: BuiltScheduleForm): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(form.fields)) formData.append(key, value);
  form.files.forEach((file) => formData.append("files", file));
  return formData;
}
