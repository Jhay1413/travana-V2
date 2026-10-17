import { describe, expect, it } from "vitest";
import { bodyToHtml, validateNewMessage } from "./new-message-validation";

const ok = { clientId: "c1", contactId: "k1", channelId: "ch1", channelType: "whatsapp", subject: "", body: "Hi" };

describe("validateNewMessage", () => {
  it("passes a complete message", () => {
    expect(validateNewMessage(ok)).toEqual({});
  });
  it("requires a client and contact", () => {
    expect(validateNewMessage({ ...ok, clientId: null }).clientId).toBe("Choose who the message is for.");
    expect(validateNewMessage({ ...ok, contactId: null }).clientId).toBe("Choose who the message is for.");
  });
  it("requires a channel", () => {
    expect(validateNewMessage({ ...ok, channelId: null, channelType: null }).channel).toBe("Choose how to send it.");
  });
  it("requires a subject only for email", () => {
    expect(validateNewMessage({ ...ok, channelType: "email", subject: "  " }).subject).toBe("Add a subject for the email.");
    expect(validateNewMessage({ ...ok, channelType: "email", subject: "Hi" }).subject).toBeUndefined();
    expect(validateNewMessage(ok).subject).toBeUndefined();
  });
  it("requires a body", () => {
    expect(validateNewMessage({ ...ok, body: "  \n" }).body).toBe("Write a message.");
  });
});

describe("bodyToHtml", () => {
  it("escapes and converts newlines", () => {
    expect(bodyToHtml("a <b> & c\nd")).toBe("a &lt;b&gt; &amp; c<br>d");
  });
});
