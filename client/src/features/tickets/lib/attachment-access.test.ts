import { describe, expect, it } from "vitest";
import { canDeleteAttachment } from "./attachment-access";

const base = { userId: "me", isAdmin: false, ticketUserId: "raiser", replyAuthorId: null as string | null };

describe("canDeleteAttachment", () => {
  it("lets the reply author delete reply files", () => {
    expect(canDeleteAttachment({ ...base, replyAuthorId: "me" })).toBe(true);
    expect(canDeleteAttachment({ ...base, replyAuthorId: "other" })).toBe(false);
  });
  it("lets the ticket raiser delete ticket-level files", () => {
    expect(canDeleteAttachment({ ...base, ticketUserId: "me" })).toBe(true);
    expect(canDeleteAttachment(base)).toBe(false);
  });
  it("does not let the raiser delete someone else's reply file", () => {
    expect(canDeleteAttachment({ ...base, ticketUserId: "me", replyAuthorId: "other" })).toBe(false);
  });
  it("lets admin roles delete anything", () => {
    expect(canDeleteAttachment({ ...base, isAdmin: true })).toBe(true);
    expect(canDeleteAttachment({ ...base, isAdmin: true, replyAuthorId: "other" })).toBe(true);
  });
  it("denies everyone when the viewer is unknown", () => {
    expect(canDeleteAttachment({ ...base, userId: undefined, isAdmin: true })).toBe(false);
  });
});
