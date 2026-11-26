import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildPurposeTemplateUpsert, buildUpsertQuery } from "./whatsapp-settings.repository";

const dialect = new PgDialect();
const render = (data: Parameters<typeof buildUpsertQuery>[1]) => dialect.sqlToQuery(buildUpsertQuery("o1", data, "u1"));

describe("buildUpsertQuery: only the columns being written are named", () => {
  it("a quote save never mentions the sign-in link columns, so it works before they exist", () => {
    const q = render({ quoteTemplateName: "q", quoteTemplateLanguage: "en", quoteTemplateChannelId: "c", quoteTemplateVariables: { "1": { source: "quote_link" } } });
    expect(q.sql).not.toContain("pin_reset_");
    expect(q.sql).not.toContain("update_template_");
    expect(q.sql).toContain("quote_template_name");
    expect(q.sql.toLowerCase()).toContain("returning quote_template_name");
  });

  it("a general-update save never mentions the sign-in link columns", () => {
    const q = render({ updateTemplateName: "u", updateTemplateLanguage: "en", updateTemplateChannelId: "c", updateTemplateVariables: { "1": { source: "message" } } });
    expect(q.sql).not.toContain("pin_reset_");
    expect(q.sql).not.toContain("quote_template_");
  });

  it("clearing a template (nulls and {}) is still only its own columns", () => {
    const q = render({ quoteTemplateName: null, quoteTemplateLanguage: null, quoteTemplateChannelId: null, quoteTemplateVariables: {} });
    expect(q.sql).not.toContain("pin_reset_");
    expect(q.params).toContain("{}");
  });

  it("only the sign-in link save names the new columns", () => {
    const q = render({ pinResetTemplateName: "p", pinResetTemplateLanguage: "en", pinResetTemplateChannelId: "c", pinResetTemplateVariables: { "1": { source: "sign_in_link" } } });
    expect(q.sql).toContain("pin_reset_template_name");
    expect(q.sql).not.toContain("quote_template_");
    expect(q.sql).not.toContain("update_template_");
  });

  it("is scoped to the org, passes values as parameters and upserts on org_id", () => {
    const q = render({ quoteTemplateName: "q'; drop table x; --" });
    expect(q.params[0]).toBe("o1");
    expect(q.params).toContain("q'; drop table x; --");
    expect(q.sql).not.toContain("drop table");
    expect(q.sql).toContain("on conflict (org_id) do update");
  });

  it("never lists every table column (no id, created_at or unrelated columns)", () => {
    const q = render({ quoteTemplateName: "q" });
    expect(q.sql).not.toContain("created_at");
  });
});

describe("purpose_templates (the column added for automatic messages)", () => {
  it("no existing save names it, so quote, update and sign-in saves work before the column exists", () => {
    for (const data of [
      { quoteTemplateName: "q", quoteTemplateVariables: {} },
      { updateTemplateName: "u", updateTemplateVariables: {} },
      { pinResetTemplateName: "p", pinResetTemplateVariables: {} },
    ]) {
      expect(render(data).sql).not.toContain("purpose_templates");
    }
  });

  it("the purpose save names only that column and merges into what is stored", () => {
    const cfg = { templateName: "t", language: "en", channelId: "c", variables: { "1": { source: "destination" as const } } };
    const q = dialect.sqlToQuery(buildPurposeTemplateUpsert("o1", "booking_confirmation", cfg, "u1"));
    expect(q.sql).toContain("purpose_templates");
    expect(q.sql).not.toContain("quote_template_");
    expect(q.sql).not.toContain("update_template_");
    expect(q.sql).not.toContain("pin_reset_");
    expect(q.sql).toContain("|| excluded.purpose_templates");
    expect(q.sql).toContain("on conflict (org_id) do update");
    expect(q.params[0]).toBe("o1");
    expect(JSON.parse(String(q.params[2]))).toEqual({ booking_confirmation: cfg });
  });

  it("the read paths used by quote, update and sign-in never select it", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./whatsapp-settings.repository.ts", import.meta.url), "utf8");
    const between = (from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));
    expect(between("async findByOrg", "async findPinResetByOrg")).not.toContain("purposeTemplates");
    expect(between("async findPinResetByOrg", "async findPurposeTemplatesByOrg")).not.toContain("purposeTemplates");
  });
});
