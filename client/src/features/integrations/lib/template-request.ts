import type { CreateWaTemplateInput, WaTemplateButton, WaTemplateCategory } from "../types";
import { bodyProblem, extractPlaceholders } from "./template-placeholders";

const NAME = /^[a-z0-9_]+$/;

export interface TemplateRequestForm {
  name: string;
  category: WaTemplateCategory;
  language: string;
  header: string;
  body: string;
  examples: Record<string, string>;
  footer: string;
  buttonKind: "none" | "URL" | "QUICK_REPLY";
  buttonText: string;
  buttonUrl: string;
}

export function nameProblem(name: string): string | null {
  if (!name) return null;
  return NAME.test(name) ? null : "Use lowercase letters, numbers and underscores only.";
}

/** First problem blocking submit, or null. */
export function requestProblem(f: TemplateRequestForm): string | null {
  if (!f.name.trim()) return "Name is required.";
  const np = nameProblem(f.name);
  if (np) return np;
  if (!f.language.trim()) return "Language is required.";
  if (f.header.length > 60) return "Header can be at most 60 characters.";
  if (f.footer.length > 60) return "Footer can be at most 60 characters.";
  if (f.body.length > 1024) return "Body can be at most 1024 characters.";
  const bp = bodyProblem(f.body);
  if (bp) return bp;
  for (const p of extractPlaceholders(f.body)) {
    if (!(f.examples[p] ?? "").trim()) return `Add an example for {{${p}}}.`;
  }
  if (f.buttonKind !== "none") {
    if (!f.buttonText.trim()) return "Button text is required.";
    if (f.buttonText.length > 25) return "Button text can be at most 25 characters.";
    if (f.buttonKind === "URL" && !/^https?:\/\/\S+$/.test(f.buttonUrl.trim())) return "Enter a full button URL starting with https://.";
  }
  return null;
}

export function toRequestInput(channelId: string, f: TemplateRequestForm): CreateWaTemplateInput {
  const button: WaTemplateButton | null =
    f.buttonKind === "none"
      ? null
      : f.buttonKind === "URL"
        ? { type: "URL", text: f.buttonText.trim(), url: f.buttonUrl.trim() }
        : { type: "QUICK_REPLY", text: f.buttonText.trim() };
  return {
    channel_id: channelId,
    name: f.name.trim(),
    category: f.category,
    language: f.language.trim(),
    header_text: f.header.trim() || undefined,
    body_text: f.body,
    body_examples: extractPlaceholders(f.body).map((p) => (f.examples[p] ?? "").trim()),
    footer_text: f.footer.trim() || undefined,
    buttons: button ? [button] : undefined,
  };
}
