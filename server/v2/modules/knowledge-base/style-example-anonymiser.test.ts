import { describe, it, expect } from "vitest";
import { anonymiseStyleExample } from "./style-example-anonymiser";

// The shape that actually leaked: a pasted conversation sitting in the KB as a
// tone example, from which the model lifted a name and greeted a DIFFERENT
// customer with it.
const PASTED_CONVERSATION = [
  "Shannon: Hi, saw your post about Disneyland Paris, is it still available?",
  "Lisa: Hi Shannon! Yes it is, lovely choice x",
  "Lisa: Can you pop me your number so I can check you on the system?",
  "Shannon: sure it's 07700 900123, email is shannon.b@example.co.uk",
  "Lisa: Perfect, got you. Thanks Shannon, I'll get some prices over shortly!",
].join("\n");

describe("anonymiseStyleExample — the leak that prompted this", () => {
  const out = anonymiseStyleExample(PASTED_CONVERSATION);

  it("removes the customer's name from every position it appears in", () => {
    expect(out).not.toMatch(/Shannon/i);
  });

  it("removes the colleague's name too", () => {
    expect(out).not.toMatch(/Lisa/i);
  });

  it("removes the phone number and email", () => {
    expect(out).not.toContain("07700 900123");
    expect(out).not.toContain("shannon.b@example.co.uk");
    expect(out).toContain("[phone number]");
    expect(out).toContain("[email]");
  });

  it("keeps the phrasing that makes it a useful tone example", () => {
    expect(out).toContain("lovely choice x");
    expect(out).toContain("Can you pop me your number so I can check you on the system?");
    expect(out).toContain("I'll get some prices over shortly!");
  });
});

describe("anonymiseStyleExample — what it must NOT touch", () => {
  it("leaves prices alone, including the ones with enough digits to look like a number", () => {
    const text = "That one's £1,299.00 per person, or £2,014 for the two of you.";
    expect(anonymiseStyleExample(text)).toBe(text);
  });

  it("leaves destinations and hotels alone — they are the tone, not the identity", () => {
    const text = "Hiya, the Volkshotel in Amsterdam is a lovely one for Christmas.";
    const out = anonymiseStyleExample(text);
    expect(out).toContain("Volkshotel");
    expect(out).toContain("Amsterdam");
  });

  it("leaves dates and times alone", () => {
    const text = "Can we say 2pm on 12/05/2026 for the callback?";
    expect(anonymiseStyleExample(text)).toBe(text);
  });

  it("does not mistake a day or month after a greeting for a name", () => {
    expect(anonymiseStyleExample("Thanks Monday works for me")).toContain("Monday");
    expect(anonymiseStyleExample("Hi May, hope you're well")).toContain("May");
  });

  it("does not redact the way we address a group", () => {
    expect(anonymiseStyleExample("Hi all, quick update")).toContain("Hi all");
    expect(anonymiseStyleExample("Hi Team, quick update")).toContain("Team");
  });
});

describe("anonymiseStyleExample — positional rules", () => {
  it("drops a vocative name rather than standing it in, so the line still reads naturally", () => {
    expect(anonymiseStyleExample("Hi Georgia, how are you?")).toBe("Hi, how are you?");
  });

  it("drops a vocative name after a thanks too", () => {
    expect(anonymiseStyleExample("Thanks Nicola!")).toBe("Thanks!");
  });

  it("redacts a full name in the vocative, not just the first part", () => {
    const out = anonymiseStyleExample("Hello Sarah Jones, lovely to hear from you");
    expect(out).not.toMatch(/Sarah|Jones/);
  });

  it("redacts a self-introduction", () => {
    expect(anonymiseStyleExample("my name is Kate")).toBe("my name is Team");
    expect(anonymiseStyleExample("this is Tracy from the office")).toContain("this is Team");
  });

  it("redacts transcript speaker labels", () => {
    expect(anonymiseStyleExample("Tina: all sorted for you")).toBe("Team: all sorted for you");
  });

  it("leaves a role label as a speaker, since it identifies nobody", () => {
    expect(anonymiseStyleExample("Customer: is it still available?")).toContain("Customer:");
    expect(anonymiseStyleExample("Agent: yes it is")).toContain("Agent:");
  });
});

describe("anonymiseStyleExample — caller-supplied names", () => {
  it("redacts a name the positional rules cannot reach", () => {
    const text = "I'll ask Shannon to give you a ring about it.";
    expect(anonymiseStyleExample(text)).toContain("Shannon");
    expect(anonymiseStyleExample(text, { extraNames: ["Shannon"] })).not.toContain("Shannon");
  });

  it("matches regardless of case", () => {
    expect(anonymiseStyleExample("spoke to shannon earlier", { extraNames: ["Shannon"] })).not.toMatch(/shannon/i);
  });

  it("consumes the longer name first so a shared first name cannot half-match", () => {
    const out = anonymiseStyleExample("Anne Marie sorted it", { extraNames: ["Anne", "Anne Marie"] });
    expect(out).toBe("Team sorted it");
  });

  it("does not match a name embedded inside a longer word", () => {
    expect(anonymiseStyleExample("Sunny beaches", { extraNames: ["Sun"] })).toContain("Sunny");
  });

  it("is a no-op on empty input", () => {
    expect(anonymiseStyleExample("")).toBe("");
  });
});

// Colleagues are never named to a customer — the bot is told to say "team", so
// the examples it learns tone from must never show a person's name either.
describe("anonymiseStyleExample — a person is always \"Team\"", () => {
  it("names nobody on our side, in any position", () => {
    const out = anonymiseStyleExample("Lisa: spoke to Tina about it, she'll ring you");
    expect(out).toBe("Team: spoke to Team about it, she'll ring you");
  });

  it("leaves no bracketed name placeholder for the model to copy", () => {
    const out = anonymiseStyleExample("Lisa: Hi Shannon, my name is Lisa");
    expect(out).not.toContain("[name]");
    expect(out).not.toMatch(/Shannon|Lisa/);
  });
});
