import { describe, it, expect } from "vitest";
import { audienceAllowedValues, type RetrievalAudience } from "./ai-embeddings.repository";
import { retrievedAudienceAllows, type BotAudience } from "../ai-conversation/ai-conversation.brain";

// audienceAllowedValues() is the SQL-side whitelist used by the repository's
// `search()` audience predicate. It must stay in lock-step with the
// fail-closed JS semantics of retrievedAudienceAllows() in
// ai-conversation.brain.ts — these tests cross-check the two directly so a
// future change to either one can't silently drift out of parity.

describe("audienceAllowedValues", () => {
  it("internal only allows 'general' — never sales/admin/internal-labelled rows", () => {
    expect(audienceAllowedValues("internal")).toEqual(["general"]);
  });

  it("general only allows 'general'", () => {
    expect(audienceAllowedValues("general")).toEqual(["general"]);
  });

  it("sales allows 'general' and 'sales'", () => {
    expect(audienceAllowedValues("sales")).toEqual(["general", "sales"]);
  });

  it("admin allows 'general' and 'admin'", () => {
    expect(audienceAllowedValues("admin")).toEqual(["general", "admin"]);
  });

  it("matches retrievedAudienceAllows() for every (bot, present-audience) pair", () => {
    const bots: BotAudience[] = ["sales", "admin", "internal"];
    const rowAudiences = ["general", "sales", "admin", "internal", "other", "General", "SALES"];

    for (const bot of bots) {
      const allowed = audienceAllowedValues(bot as RetrievalAudience);
      for (const rowAudience of rowAudiences) {
        const sqlWouldAllow = allowed.includes(rowAudience.toLowerCase());
        const jsAllows = retrievedAudienceAllows(rowAudience, bot);
        expect(sqlWouldAllow).toBe(jsAllows);
      }
    }
  });

  it("never includes a value that would let a missing/null audience through", () => {
    // Missing audience is enforced separately via IS NOT NULL in the SQL
    // predicate (see audienceCondition()) rather than via this whitelist —
    // this test just documents that the whitelist itself never contains a
    // sentinel for "missing" that could accidentally match.
    for (const bot of ["sales", "admin", "internal", "general"] as RetrievalAudience[]) {
      expect(audienceAllowedValues(bot)).not.toContain(null);
      expect(audienceAllowedValues(bot)).not.toContain("");
    }
  });
});
