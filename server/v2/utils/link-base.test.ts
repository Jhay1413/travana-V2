import { describe, expect, it } from "vitest";
import { isProductionRuntime, requestOrigin, resolveLinkBase } from "./link-base";

const PROD = "https://app.travana.co.uk";

describe("resolveLinkBase", () => {
  it("uses the request origin outside production, even when BASE_URL is set", () => {
    expect(resolveLinkBase({ configured: PROD, requestOrigin: "http://localhost:5000", isProduction: false })).toBe(
      "http://localhost:5000",
    );
  });

  it("strips any path from the request origin", () => {
    expect(
      resolveLinkBase({ configured: null, requestOrigin: "https://dev.example.repl.co/signup", isProduction: false }),
    ).toBe("https://dev.example.repl.co");
  });

  it("ignores the request origin in production", () => {
    expect(resolveLinkBase({ configured: PROD, requestOrigin: "https://evil.example", isProduction: true })).toBe(PROD);
  });

  it("falls back to the configured URL when the request origin is missing or not http(s)", () => {
    expect(resolveLinkBase({ configured: `${PROD}/`, requestOrigin: undefined, isProduction: false })).toBe(PROD);
    expect(resolveLinkBase({ configured: PROD, requestOrigin: "javascript:alert(1)", isProduction: false })).toBe(PROD);
    expect(resolveLinkBase({ configured: PROD, requestOrigin: "not a url", isProduction: false })).toBe(PROD);
  });

  it("falls back to localhost when nothing is known", () => {
    expect(resolveLinkBase({ configured: null, requestOrigin: null, isProduction: false })).toBe("http://localhost:5000");
    expect(resolveLinkBase({ configured: null, requestOrigin: null, isProduction: true })).toBe("http://localhost:5000");
  });
});

describe("isProductionRuntime", () => {
  it("detects production from NODE_ENV or a Replit deployment", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionRuntime({ REPLIT_DEPLOYMENT: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("requestOrigin", () => {
  const req = (headers: Record<string, string>, protocol = "http") =>
    ({ protocol, get: (n: string) => headers[n.toLowerCase()] }) as unknown as Parameters<typeof requestOrigin>[0];

  it("prefers the Origin header", () => {
    expect(requestOrigin(req({ origin: "http://localhost:5000", host: "x" }))).toBe("http://localhost:5000");
  });
  it("falls back to protocol + host", () => {
    expect(requestOrigin(req({ host: "localhost:5000" }))).toBe("http://localhost:5000");
  });
  it("is null with neither", () => {
    expect(requestOrigin(req({}))).toBeNull();
  });
});
