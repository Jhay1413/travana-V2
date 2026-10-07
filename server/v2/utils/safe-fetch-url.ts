import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./error-handler";

function ipv4ToParts(ip: string): number[] {
  return ip.split(".").map((part) => Number(part));
}

function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ipv4ToParts(ip);
  return (
    a === 0 || // 0.0.0.0/8 ("this" network, incl. 0.0.0.0)
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local incl. cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
  );
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) is judged by its embedded IPv4 address.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (lower === "::" || lower === "::1") return true;
  const firstGroup = parseInt(lower.split(":")[0] || "0", 16);
  return (
    (firstGroup & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (firstGroup & 0xffc0) === 0xfe80 // fe80::/10 link-local
  );
}

/** True for loopback, private, link-local, metadata and unspecified addresses (and anything unparseable). */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

/**
 * Throws a 400 AppError unless `rawUrl` is an http(s) URL whose host resolves
 * only to public addresses. Use before the server fetches a user-influenced
 * URL; pair the request with `maxRedirects: 0` so a redirect cannot hop to an
 * internal host after this check.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("Image URL is not valid", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("Image URL must be http or https", 400);
  }

  // URL keeps IPv6 literals in brackets.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new AppError("Image URL points to a private address", 400);
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new AppError("Could not resolve the image host", 502);
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new AppError("Image URL points to a private address", 400);
  }
}
