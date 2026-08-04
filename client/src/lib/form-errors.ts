import type { FieldErrors } from "react-hook-form";

// Turns a react-hook-form error path into a readable field name:
// "packageType" → "Package Type", "transfers.0.cost" → "Transfers #1 Cost".
function humanizeSegment(segment: string): string {
  if (/^\d+$/.test(segment)) return `#${Number(segment) + 1}`;
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w) => (w === "id" ? "ID" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function humanizeFieldPath(path: string): string {
  return path.split(".").map(humanizeSegment).join(" ");
}

/**
 * Flattens a FieldErrors tree into the dotted paths of every failing field.
 * Leaves are recognised by their `message`/`type` shape; `ref` holds a DOM
 * node and must not be walked.
 */
export function collectFormErrorFields(errors: FieldErrors): string[] {
  const paths: string[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.message === "string" && typeof record.type === "string") {
      paths.push(path.join("."));
      return;
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === "ref") continue;
      walk(value, [...path, key]);
    }
  };
  walk(errors, []);
  return paths;
}

/** A short human-readable summary of what failed, for a toast. */
export function summarizeFormErrors(errors: FieldErrors, max = 3): string {
  const fields = collectFormErrorFields(errors).map(humanizeFieldPath);
  if (fields.length === 0) return "Some fields are missing or invalid.";
  const shown = fields.slice(0, max).join(", ");
  const rest = fields.length - max;
  return rest > 0 ? `Check: ${shown} and ${rest} more` : `Check: ${shown}`;
}

/**
 * Scrolls the first invalid control into view and focuses it. Deferred a tick
 * so it runs after react-hook-form has re-rendered the error state (FormControl
 * stamps aria-invalid on the failing input only then).
 */
export function scrollToFirstFormError(): void {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }, 50);
}
