import { beforeEach, describe, expect, it, vi } from "vitest";

// What the staff inbox stores for customer text, and what the customer reads of an agent's reply.
// The database is a scripted fake: each db.select() pops the next queued answer, and inserts are recorded.

const h = vi.hoisted(() => {
  const selects: unknown[][] = [];
  const inserted: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const chain = (result: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "orderBy", "limit", "innerJoin", "leftJoin"]) c[m] = () => c;
    c.then = (resolve: (v: unknown[]) => unknown) => resolve(result);
    return c;
  };
  const db = {
    select: () => chain(selects.shift() ?? []),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserted.push({ table, values });
        const done = Promise.resolve([{ id: "conv-new" }]) as Promise<unknown[]> & { onConflictDoNothing: () => { returning: () => Promise<unknown[]> } };
        done.onConflictDoNothing = () => ({ returning: () => Promise.resolve([{ id: "conv-new" }]) });
        return done;
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  };
  return { selects, inserted, db };
});

vi.mock("../config/database", () => ({ db: h.db }));
vi.mock("../repositories/notification.repository", () => ({ notificationRepository: { create: vi.fn(async () => undefined) } }));
vi.mock("./push-notification.service", () => ({ pushNotificationService: { sendToClient: vi.fn(async () => undefined) } }));
vi.mock("../v2/utils/user-conditions", () => ({ notSuspendedOrBanned: () => undefined }));

import { chatMessages, portalMessages } from "@shared/schema";
import { bridgeAgentReplyToPortal, bridgePortalMessageToChat, chatContentForPortalMessage } from "./portal-chat-bridge";
import { plainTextToHtml } from "../v2/utils/escape-html";
import { richTextToPlainText } from "../v2/utils/rich-text-to-plain";

/** Scripted answers for a message from a customer who has an owning agent and an existing conversation. */
function scriptDirectThread(): void {
  h.selects.push(
    [{ firstName: "Sam", surename: "Traveller" }], // client name
    [{ orgId: "o1" }], // client org
    [{ userId: "agent-1" }], // owning agent
    [{ id: "conv-1" }], // existing conversation
    [{ userId: "agent-1" }, { userId: "portal-client:c1" }], // participants
  );
}

const storedChatContent = (): string => {
  const row = h.inserted.find((i) => i.table === chatMessages);
  return String(row?.values.content);
};

beforeEach(() => {
  h.selects.length = 0;
  h.inserted.length = 0;
});

describe("customer text in the staff inbox", () => {
  it("is stored escaped, with each line break as <br>, so staff read exactly what was typed", async () => {
    scriptDirectThread();
    const typed = `Hi <a href="https://evil.example">click</a>\n<img src=x onerror=alert(1)>\n<script>alert(2)</script>\nLast & line`;
    await bridgePortalMessageToChat("c1", typed, false);
    const stored = storedChatContent();
    expect(stored).toBe(
      "Hi &lt;a href=&quot;https://evil.example&quot;&gt;click&lt;/a&gt;<br>&lt;img src=x onerror=alert(1)&gt;<br>&lt;script&gt;alert(2)&lt;/script&gt;<br>Last &amp; line",
    );
    expect(stored).not.toMatch(/<(?!br>)/);
    expect(stored.split("<br>")).toHaveLength(4);
  });

  it("the Message sheet's multi-line text keeps its lines (CRLF and LF)", async () => {
    scriptDirectThread();
    await bridgePortalMessageToChat("c1", "About: Cyprus\r\nExtras: car hire\nHello", false);
    expect(storedChatContent()).toBe("About: Cyprus<br>Extras: car hire<br>Hello");
  });

  it("a quote request's bullet lines are escaped the same way", () => {
    expect(chatContentForPortalMessage("Quote Request:\n• Destination: <b>Spain</b>")).toBe("Quote Request:<br>• Destination: &lt;b&gt;Spain&lt;/b&gt;");
  });

  it("the deal-interest message still stores its one server-built link (values escaped)", async () => {
    scriptDirectThread();
    const chatHtml = `❤️ Interested in deal: <a href="/quotes/abc">A &amp; B &lt;Deal&gt;</a>`;
    await bridgePortalMessageToChat("c1", "❤️ Interested in deal: A & B <Deal> [deal:abc]", true, { html: chatHtml, preview: "p" });
    const stored = storedChatContent();
    expect(stored).toContain('<a href="/quotes/abc"');
    expect(stored).toContain("A &amp; B &lt;Deal&gt;");
    expect((stored.match(/<a /g) ?? []).length).toBe(1);
  });

  it("a script inside the server-built markup is still stripped", () => {
    expect(chatContentForPortalMessage("x", { html: `<a href="/q">ok</a><script>alert(1)</script>` })).not.toContain("<script");
  });
});

describe("plainTextToHtml", () => {
  it("escapes the five characters and converts every kind of line break", () => {
    expect(plainTextToHtml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;");
    expect(plainTextToHtml("1\n2\r\n3\r4")).toBe("1<br>2<br>3<br>4");
  });
  it("is linear on a long adversarial string", () => {
    const start = performance.now();
    plainTextToHtml("<\r\n".repeat(60_000));
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe("an agent's reply as the customer reads it (plain text, never tags)", () => {
  it("turns the editor's paragraphs and line breaks into lines and drops every tag", () => {
    expect(richTextToPlainText("<p>Hello Sam</p><p>See you <strong>soon</strong> &amp; safe travels<br>Ann</p>")).toBe("Hello Sam\nSee you soon & safe travels\nAnn");
  });
  it("shows a link as its text and typed angle brackets as text, and never keeps a script", () => {
    expect(richTextToPlainText(`<p>Pay <a href="https://x.example">here</a></p><script>alert(1)</script>`)).toBe("Pay here");
    expect(richTextToPlainText("<p>2 &lt; 3 and 5 &gt; 4</p>")).toBe("2 < 3 and 5 > 4");
  });
  it("is linear on a long run of '<'", () => {
    const start = performance.now();
    richTextToPlainText("<".repeat(100_000));
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("is stored in portal_messages as that plain text, with the agent's name", async () => {
    h.selects.push([{ portalClientId: "c1" }]);
    await bridgeAgentReplyToPortal("conv-1", "agent-1", "Ann", "<p>Your <b>quote</b> is ready</p><p>Call me</p>");
    const row = h.inserted.find((i) => i.table === portalMessages);
    expect(row?.values).toMatchObject({ clientId: "c1", sender: "agent", agentName: "Ann", text: "Your quote is ready\nCall me" });
  });

  it("sends nothing for a reply that is only markup", async () => {
    h.selects.push([{ portalClientId: "c1" }]);
    await bridgeAgentReplyToPortal("conv-1", "agent-1", "Ann", "<p><br></p>");
    expect(h.inserted.find((i) => i.table === portalMessages)).toBeUndefined();
  });
});
