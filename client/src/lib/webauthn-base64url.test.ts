import { describe, it, expect } from "vitest";
import { base64urlToBytes, bytesToBase64url, toCreationOptions, toRequestOptions } from "./webauthn-base64url";

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(base64urlToBytes(bytesToBase64url(bytes)))).toEqual(Array.from(bytes));
  });

  it("uses the URL-safe alphabet without padding", () => {
    const encoded = bytesToBase64url(new Uint8Array([251, 255, 254, 62, 63]));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(encoded).toBe("-__-Pj8");
  });

  it("encodes an ArrayBuffer the same as a Uint8Array", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(bytesToBase64url(bytes.buffer)).toBe(bytesToBase64url(bytes));
  });
});

describe("option converters", () => {
  it("decodes challenge, user id and credential ids for registration", () => {
    const out = toCreationOptions({
      challenge: "AQID",
      rp: { name: "x", id: "a.example" },
      user: { id: "BAUG", name: "n", displayName: "n" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      excludeCredentials: [{ id: "BwgJ", type: "public-key", transports: ["internal"] }],
    });
    expect(Array.from(out.challenge as Uint8Array)).toEqual([1, 2, 3]);
    expect(Array.from(out.user.id as Uint8Array)).toEqual([4, 5, 6]);
    expect(Array.from(out.excludeCredentials![0].id as Uint8Array)).toEqual([7, 8, 9]);
  });

  it("decodes the challenge for sign-in", () => {
    const out = toRequestOptions({ challenge: "AQID", rpId: "a.example", userVerification: "required" });
    expect(Array.from(out.challenge as Uint8Array)).toEqual([1, 2, 3]);
    expect(out.rpId).toBe("a.example");
  });
});
