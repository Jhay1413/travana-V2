import { describe, it, expect } from "vitest";
import { allowedOriginsFor, browserArgsFor } from "./browser-guard";

describe("browserArgsFor", () => {
  it("is exactly the main suite's flag for localhost only", () => {
    expect(browserArgsFor(["localhost", "127.0.0.1"])).toEqual(["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"]);
  });

  it("lets the portal host name resolve by exact name, never by wildcard, so every other name still fails", () => {
    const [arg] = browserArgsFor(["localhost", "127.0.0.1", "portal.localhost"]);
    expect(arg).toContain("EXCLUDE portal.localhost");
    expect(arg).not.toContain("*.localhost");
    expect(arg.startsWith("--host-resolver-rules=MAP * ~NOTFOUND")).toBe(true);
    expect(arg).not.toContain("other.localhost");
  });
});

describe("allowedOriginsFor", () => {
  it("allows only the test server in the main suite", () => {
    expect([...allowedOriginsFor("http://localhost:5055", null)]).toEqual(["http://localhost:5055"]);
  });
  it("adds the portal host name in the two-host run, and nothing else", () => {
    const origins = allowedOriginsFor("http://localhost:5057", "http://portal.localhost:5057");
    expect(origins.has("http://portal.localhost:5057")).toBe(true);
    expect(origins.has("http://other.localhost:5057")).toBe(false);
    expect(origins.has("https://evil.example")).toBe(false);
  });
});
