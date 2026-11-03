// Needs a live Postgres: run with `npm run test:integration`. Written, not run by `npm test`.
import { describe, it, expect, beforeEach } from "vitest";
import { whatsappSettingsRepository } from "./whatsapp-settings.repository";
import { truncateAll, makeOrg } from "../../test/factories";

let orgA: { id: string };
let orgB: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
});

describe("whatsappSettingsRepository", () => {
  it("returns null for an org with no row", async () => {
    expect(await whatsappSettingsRepository.findByOrg(orgA.id)).toBeNull();
  });

  it("writing the update template leaves the quote template alone, and vice versa", async () => {
    await whatsappSettingsRepository.upsert(
      orgA.id,
      { quoteTemplateName: "quote_ready", quoteTemplateVariables: { "1": { source: "quote_link" } } },
      null,
    );
    await whatsappSettingsRepository.upsert(
      orgA.id,
      { updateTemplateName: "general_update", updateTemplateVariables: { "1": { source: "message" } } },
      null,
    );
    let row = await whatsappSettingsRepository.findByOrg(orgA.id);
    expect(row?.quoteTemplateName).toBe("quote_ready");
    expect(row?.quoteTemplateVariables).toEqual({ "1": { source: "quote_link" } });
    expect(row?.updateTemplateName).toBe("general_update");

    await whatsappSettingsRepository.upsert(orgA.id, { quoteTemplateName: null, quoteTemplateVariables: {} }, null);
    row = await whatsappSettingsRepository.findByOrg(orgA.id);
    expect(row?.quoteTemplateName).toBeNull();
    expect(row?.updateTemplateName).toBe("general_update");
    expect(row?.updateTemplateVariables).toEqual({ "1": { source: "message" } });
  });

  it("is scoped to the org", async () => {
    await whatsappSettingsRepository.upsert(orgA.id, { updateTemplateName: "general_update" }, null);
    expect(await whatsappSettingsRepository.findByOrg(orgB.id)).toBeNull();
  });
});
