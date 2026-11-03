import { AppError } from "../../utils/error-handler";
import { whatsappTemplatesRepository } from "./whatsapp-templates.repository";
import { extractPlaceholders } from "./whatsapp-templates.validator";
import type {
  CreateTemplateInput,
  CreateTemplateResult,
  SsSyncResult,
  SsTemplateComponent,
  SsWhatsappTemplate,
  TemplateListQuery,
} from "./whatsapp-templates.types";

function ensureConfigured(): void {
  if (!whatsappTemplatesRepository.isConfigured()) throw new AppError("Messaging workspace not configured", 503);
}

export function buildComponents(input: CreateTemplateInput): SsTemplateComponent[] {
  const components: SsTemplateComponent[] = [];
  if (input.header_text) components.push({ type: "HEADER", format: "TEXT", text: input.header_text });
  const body: SsTemplateComponent = { type: "BODY", text: input.body_text };
  if (extractPlaceholders(input.body_text).length > 0) body.example = { body_text: [input.body_examples] };
  components.push(body);
  if (input.footer_text) components.push({ type: "FOOTER", text: input.footer_text });
  if (input.buttons && input.buttons.length > 0) components.push({ type: "BUTTONS", buttons: input.buttons });
  return components;
}

export const whatsappTemplatesService = {
  async list(query: TemplateListQuery): Promise<{ templates: SsWhatsappTemplate[]; total: number }> {
    ensureConfigured();
    const result = await whatsappTemplatesRepository.list(query);
    return { templates: result.templates ?? [], total: result.total ?? 0 };
  },

  async sync(channelId: string): Promise<SsSyncResult> {
    ensureConfigured();
    return whatsappTemplatesRepository.sync(channelId);
  },

  async create(input: CreateTemplateInput): Promise<CreateTemplateResult> {
    ensureConfigured();
    const res = await whatsappTemplatesRepository.create({
      channel_id: input.channel_id,
      name: input.name,
      category: input.category,
      language: input.language,
      components: buildComponents(input),
      allow_category_change: true,
    });
    if (res.success === false) {
      throw new AppError(res.meta_user_message ?? res.meta_message ?? res.error ?? "Meta rejected the template", 400);
    }
    return { id: res.id ?? null, template_id: res.template_id ?? null, status: res.status ?? null };
  },

  async remove(id: string): Promise<{ removed: true }> {
    ensureConfigured();
    await whatsappTemplatesRepository.remove(id);
    return { removed: true };
  },
};
