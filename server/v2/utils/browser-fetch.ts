import { AppError } from "./error-handler";
import { assertPublicHttpUrl } from "./safe-fetch-url";
import { withEasyJetBrowser } from "../modules/easyjet/easyjet-browser";
import { buildBrowserContext } from "../modules/easyjet/easyjet.context";

// Fetches a URL through a real browser engine, for CDNs (e.g. Akamai) that 403
// plain HTTP clients. Reuses the easyJet launcher, so it needs local Chrome
// (override the binary with EASYJET_CHROME_PATH) or a configured Browserless/Steel.

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const MAX_CONCURRENT_PAGES = 2;

export interface BrowserFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface BrowserFetchResult {
  buffer: Buffer;
  contentType: string | null;
  status: number;
}

// Small FIFO gate so a burst of jobs can't launch many Chrome instances at once.
let active = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT_PAGES) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function releaseSlot(): void {
  const next = waiters.shift();
  if (next) next(); // slot passes straight to the next waiter
  else active -= 1;
}

export async function fetchViaHeadlessBrowser(url: string, opts: BrowserFetchOptions = {}): Promise<BrowserFetchResult> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  await assertPublicHttpUrl(url);

  await acquireSlot();
  try {
    return await withEasyJetBrowser(buildBrowserContext(), async (browser) => {
      const page = await browser.newPage();
      try {
        const res = await page.goto(url, { waitUntil: "load", timeout });
        if (!res) throw new AppError("Headless browser got no response", 502);
        const status = res.status();
        if (status >= 400) throw new AppError(`Headless browser fetch failed with status ${status}`, 502);

        // page.goto follows redirects — re-check every hop and the final host.
        const hops = [...res.request().redirectChain().map((r) => r.url()), res.url()];
        for (const hop of hops) await assertPublicHttpUrl(hop);

        const buffer = Buffer.from(await res.buffer());
        if (buffer.length > maxBytes) throw new AppError("Image is too large", 502);
        return { buffer, contentType: res.headers()["content-type"] ?? null, status };
      } finally {
        await page.close().catch(() => undefined);
      }
    });
  } finally {
    releaseSlot();
  }
}
