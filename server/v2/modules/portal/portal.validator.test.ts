import { describe, it, expect } from "vitest";
import {
  listPortalDealsValidator,
  portalChangePinValidator,
  portalDealFiltersValidator,
  portalForYouValidator,
  portalInterestValidator,
  portalLoginValidator,
  portalMagicLoginValidator,
  portalPushSubscribeValidator,
  portalPushUnsubscribeValidator,
  portalQuoteTokenValidator,
  portalSendMessageValidator,
  portalSetTagsValidator,
  portalWebauthnCheckValidator,
  portalWebauthnOptionsValidator,
  portalWebauthnLoginValidator,
  portalWebauthnRegisterValidator,
  portalWithdrawValidator,
} from "./portal.validator";

const messageOf = (r: { success: boolean; error?: { errors: Array<{ message: string }> } }) =>
  r.success ? null : r.error?.errors[0].message;

describe("portalLoginValidator", () => {
  it("accepts email + pin", () => {
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234" } }).success).toBe(true);
  });

  it("accepts an optional agency slug", () => {
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234", org: "Tinas-Travel" } }).success).toBe(true);
  });

  it.each([
    ["missing email", { pin: "1234" }],
    ["missing pin", { email: "a@b.com" }],
    ["blank email", { email: "  ", pin: "1234" }],
    ["non-string pin", { email: "a@b.com", pin: 1234 }],
  ])("rejects %s with the original message", (_n, body) => {
    expect(messageOf(portalLoginValidator.safeParse({ body }))).toBe("Email and PIN are required");
  });

  it.each(["", "bad slug", "../etc", "-lead"])("rejects an unusable org slug %j", (org) => {
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234", org } }).success).toBe(false);
  });

  it("accepts a well-formed preferOrg (even a stale one: it changes nothing server-side) and rejects a malformed one", () => {
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234", preferOrg: "agency-a" } }).success).toBe(true);
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234", preferOrg: "long-gone-agency" } }).success).toBe(true);
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234", preferOrg: "gone slug!" } }).success).toBe(false);
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin: "1234", preferOrg: "a".repeat(101) } }).success).toBe(false);
  });

  it("bounds the email at 254 characters", () => {
    expect(portalLoginValidator.safeParse({ body: { email: "a".repeat(244) + "@b.co.uk", pin: "1234" } }).success).toBe(true);
    expect(portalLoginValidator.safeParse({ body: { email: "a".repeat(250) + "@b.com", pin: "1234" } }).success).toBe(false);
  });

  it.each(["123", "12345", "12a4", "١٢٣٤", " 123", "1234 ", ""])("requires exactly four ASCII digits for the PIN (rejects %j)", (pin) => {
    expect(portalLoginValidator.safeParse({ body: { email: "a@b.com", pin } }).success).toBe(false);
  });
});

describe("portalMagicLoginValidator", () => {
  it("requires a code", () => {
    expect(portalMagicLoginValidator.safeParse({ body: { code: "abc" } }).success).toBe(true);
    expect(messageOf(portalMagicLoginValidator.safeParse({ body: {} }))).toBe("Code required");
  });
});

describe("portalChangePinValidator", () => {
  it("accepts exactly four digits", () => {
    expect(portalChangePinValidator.safeParse({ body: { newPin: "9876" } }).success).toBe(true);
  });

  it.each(["123", "12345", "12a4", ""])("rejects %j", (newPin) => {
    expect(messageOf(portalChangePinValidator.safeParse({ body: { newPin } }))).toBe("Valid 4-digit PIN required");
  });

  it("rejects a missing PIN", () => {
    expect(messageOf(portalChangePinValidator.safeParse({ body: {} }))).toBe("Valid 4-digit PIN required");
  });
});

describe("webauthn validators", () => {
  const registration = {
    id: "cred", rawId: "cred", type: "public-key", clientExtensionResults: {},
    response: { clientDataJSON: "cd", attestationObject: "ao", transports: ["internal"] },
  };
  const assertion = {
    id: "cred", rawId: "cred", type: "public-key", clientExtensionResults: {},
    response: { clientDataJSON: "cd", authenticatorData: "ad", signature: "sig", userHandle: "uh" },
  };

  it("register accepts a challenge token plus an attestation response", () => {
    expect(portalWebauthnRegisterValidator.safeParse({ body: { challengeToken: "t", response: registration, deviceName: "iPhone" } }).success).toBe(true);
  });

  it("register rejects a missing token or response, and unknown keys", () => {
    expect(messageOf(portalWebauthnRegisterValidator.safeParse({ body: { response: registration } }))).toBe("Missing credential data");
    expect(portalWebauthnRegisterValidator.safeParse({ body: { challengeToken: "t" } }).success).toBe(false);
    expect(portalWebauthnRegisterValidator.safeParse({ body: { challengeToken: "t", response: registration, clientId: "x" } }).success).toBe(false);
  });

  it("login accepts a challenge token plus an assertion response", () => {
    expect(portalWebauthnLoginValidator.safeParse({ body: { challengeToken: "t", response: assertion } }).success).toBe(true);
  });

  it("login REJECTS the old { credentialId, clientId } request shape", () => {
    const old = portalWebauthnLoginValidator.safeParse({ body: { credentialId: "c", clientId: "id" } });
    expect(old.success).toBe(false);
    expect(messageOf(old)).toBe("Missing credential data");
  });

  it("login rejects the old shape even when sent alongside a valid-looking new one", () => {
    expect(portalWebauthnLoginValidator.safeParse({ body: { challengeToken: "t", response: assertion, credentialId: "c", clientId: "id" } }).success).toBe(false);
  });

  it("login rejects an assertion with no signature, and a response of the wrong type", () => {
    const noSig = { ...assertion, response: { clientDataJSON: "cd", authenticatorData: "ad" } };
    expect(portalWebauthnLoginValidator.safeParse({ body: { challengeToken: "t", response: noSig } }).success).toBe(false);
    expect(portalWebauthnLoginValidator.safeParse({ body: { challengeToken: "t", response: { ...assertion, type: "password" } } }).success).toBe(false);
  });

  it("options/check take no required input", () => {
    expect(portalWebauthnOptionsValidator.safeParse({ body: {} }).success).toBe(true);
    expect(portalWebauthnOptionsValidator.safeParse({}).success).toBe(true);
    expect(portalWebauthnCheckValidator.safeParse({ body: {} }).success).toBe(true);
  });
});

describe("listPortalDealsValidator", () => {
  it("accepts the filters and an org slug", () => {
    const r = listPortalDealsValidator.safeParse({ query: { country: "Italy", tag: "Beach", recent: "1", interests: "0", org: "agency-a" } });
    expect(r.success).toBe(true);
  });

  it("accepts no query at all (the service then fails closed)", () => {
    expect(listPortalDealsValidator.safeParse({ query: {} }).success).toBe(true);
  });

  it("rejects a malformed flag", () => {
    expect(listPortalDealsValidator.safeParse({ query: { recent: "yes" } }).success).toBe(false);
  });

  it("does not turn a junk org into a 400 (the service ignores it; a session needs none)", () => {
    expect(listPortalDealsValidator.safeParse({ query: { org: "a b" } }).success).toBe(true);
    expect(listPortalDealsValidator.safeParse({ query: { org: "x".repeat(300) } }).success).toBe(false);
  });
});

describe("deal filters / for-you validators", () => {
  it("filters accept an org slug", () => {
    expect(portalDealFiltersValidator.safeParse({ query: { org: "agency-a" } }).success).toBe(true);
    expect(portalDealFiltersValidator.safeParse({ query: { org: "no spaces" } }).success).toBe(true);
  });

  it("for-you accepts recent=1", () => {
    expect(portalForYouValidator.safeParse({ query: { recent: "1" } }).success).toBe(true);
    expect(portalForYouValidator.safeParse({ query: { recent: "x" } }).success).toBe(false);
  });
});

describe("input bounds on the other portal inputs", () => {
  it("magic-login code is bounded", () => {
    expect(portalMagicLoginValidator.safeParse({ body: { code: "x".repeat(64) } }).success).toBe(true);
    expect(portalMagicLoginValidator.safeParse({ body: { code: "x".repeat(65) } }).success).toBe(false);
  });

  it("message text, deal id, tag ids, push and bank fields are bounded", () => {
    expect(portalSendMessageValidator.safeParse({ body: { text: "x".repeat(5001) } }).success).toBe(false);
    expect(portalSendMessageValidator.safeParse({ body: { text: "x".repeat(5000) } }).success).toBe(true);
    expect(portalInterestValidator.safeParse({ body: { dealId: "x".repeat(101) } }).success).toBe(false);
    expect(portalSetTagsValidator.safeParse({ body: { tagIds: Array.from({ length: 101 }, () => "t") } }).success).toBe(false);
    expect(portalSetTagsValidator.safeParse({ body: { tagIds: ["x".repeat(101)] } }).success).toBe(false);
    expect(portalPushUnsubscribeValidator.safeParse({ body: { endpoint: "x".repeat(2049) } }).success).toBe(false);
    expect(portalPushSubscribeValidator.safeParse({ body: { subscription: { endpoint: "https://e", keys: { p256dh: "p".repeat(513), auth: "a" } } } }).success).toBe(false);
    const bank = { account_name: "A", account_number: "12345678", sort_code: "112233" };
    expect(portalWithdrawValidator.safeParse({ body: { amount: "9".repeat(21), ...bank } }).success).toBe(false);
    expect(portalWithdrawValidator.safeParse({ body: { amount: "5", ...bank, account_name: "A".repeat(65) } }).success).toBe(false);
  });

  it("deal query strings and the share-token param are bounded", () => {
    expect(listPortalDealsValidator.safeParse({ query: { country: "x".repeat(101) } }).success).toBe(false);
    expect(listPortalDealsValidator.safeParse({ query: { tag: "x".repeat(101) } }).success).toBe(false);
    expect(portalQuoteTokenValidator.safeParse({ params: { token: "x".repeat(201) } }).success).toBe(false);
  });

  it("webauthn credential ids and transports are bounded", () => {
    const base = { id: "c", rawId: "c", type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: "cd", attestationObject: "ao" } };
    expect(portalWebauthnRegisterValidator.safeParse({ body: { challengeToken: "t", response: { ...base, id: "x".repeat(1025) } } }).success).toBe(false);
    expect(portalWebauthnRegisterValidator.safeParse({ body: { challengeToken: "t", response: { ...base, response: { ...base.response, transports: Array.from({ length: 11 }, () => "internal") } } } }).success).toBe(false);
  });
});

describe("messages, tags, push, wallet", () => {
  it("message needs text", () => {
    expect(messageOf(portalSendMessageValidator.safeParse({ body: { text: "  " } }))).toBe("Message text required");
  });

  it("interest needs a deal id", () => {
    expect(portalInterestValidator.safeParse({ body: { dealId: "q1" } }).success).toBe(true);
    expect(portalInterestValidator.safeParse({ body: {} }).success).toBe(false);
  });

  it("my-tags needs at least one tag", () => {
    expect(portalSetTagsValidator.safeParse({ body: { tagIds: ["t1"] } }).success).toBe(true);
    expect(messageOf(portalSetTagsValidator.safeParse({ body: { tagIds: [] } }))).toBe("At least one tag is required");
    expect(messageOf(portalSetTagsValidator.safeParse({ body: {} }))).toBe("At least one tag is required");
  });

  it("push subscribe needs endpoint and both keys", () => {
    const ok = { subscription: { endpoint: "https://e", keys: { p256dh: "p", auth: "a" } } };
    expect(portalPushSubscribeValidator.safeParse({ body: ok }).success).toBe(true);
    expect(messageOf(portalPushSubscribeValidator.safeParse({ body: { subscription: { endpoint: "https://e", keys: { p256dh: "p" } } } }))).toBe("Invalid subscription");
    expect(messageOf(portalPushSubscribeValidator.safeParse({ body: {} }))).toBe("Invalid subscription");
  });

  it("push unsubscribe needs an endpoint", () => {
    expect(messageOf(portalPushUnsubscribeValidator.safeParse({ body: {} }))).toBe("Endpoint required");
  });

  it("withdraw needs a positive amount and bank details", () => {
    const bank = { account_name: "A", account_number: "12345678", sort_code: "112233" };
    expect(portalWithdrawValidator.safeParse({ body: { amount: "25.50", ...bank } }).success).toBe(true);
    expect(portalWithdrawValidator.safeParse({ body: { amount: 10, ...bank } }).success).toBe(true);
    expect(messageOf(portalWithdrawValidator.safeParse({ body: { amount: "0", ...bank } }))).toBe("amount must be a positive number");
    expect(messageOf(portalWithdrawValidator.safeParse({ body: { amount: "abc", ...bank } }))).toBe("amount must be a positive number");
    expect(messageOf(portalWithdrawValidator.safeParse({ body: { amount: "5", account_name: "A" } }))).toBe(
      "account_name, account_number and sort_code are required",
    );
  });

  it("quote token param is required", () => {
    expect(portalQuoteTokenValidator.safeParse({ params: { token: "abc" } }).success).toBe(true);
    expect(portalQuoteTokenValidator.safeParse({ params: {} }).success).toBe(false);
  });
});
