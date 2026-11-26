/**
 * Helpers for the portal's documents and passports specs. Setup only: files and passengers are written straight to the
 * practice database; the specs assert through the real screens and the portal's own endpoints. The passport READ endpoint
 * is always stubbed with page.route (a real AI provider is never called).
 */
import "./test-db-env";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { PortalPassportReadResult } from "../../shared/portal-passengers";
import { queryRows, unique } from "./seed";

export interface SeedFileOptions {
  /** The original file name (the agent's title, when there is one, is shown instead). */
  name: string;
  title?: string | null;
  category?: string | null;
  mimeType?: string;
  size?: number;
  /** Shorthand for `link: { type: "Booking", id }` (the staff dialog stores the booking's real id). */
  bookingId?: string;
  /**
   * What staff linked the file to. The customer sees a file ONLY when this is a real booking, quote or enquiry of their
   * own (not a test deal). Leave it out for a file linked to nothing (the customer never sees those).
   */
  link?: { type: "Booking" | "Quote" | "Enquiry"; id: string };
  /**
   * How the bytes are stored. "none" (default): a bare name with nothing on disk (listed, but a download is a 404).
   * "local": a real legacy file under uploads/client-files, which the portal streams. "s3": an object key under
   * client-files/ (the portal answers with a signed link; nothing is fetched from it in the practice environment).
   */
  storage?: "none" | "local" | "s3";
}

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads", "client-files");

/**
 * Stub files this run wrote under uploads/client-files. That folder also holds real uploads and is in the repository,
 * so every stub is removed when the test worker exits: a run must leave nothing behind there.
 */
const writtenLocalFiles = new Set<string>();
process.once("exit", () => {
  for (const file of writtenLocalFiles) rmSync(file, { force: true });
});

/** A file on the client's profile, as the staff Files tab leaves it. */
export async function seedPortalFile(clientId: string, opts: SeedFileOptions): Promise<string> {
  const link = opts.link ?? (opts.bookingId ? { type: "Booking" as const, id: opts.bookingId } : null);
  const stored = `${unique("file")}-${opts.name}`;
  let filename = stored;
  if (opts.storage === "s3") filename = `client-files/${stored}`;
  if (opts.storage === "local") {
    mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
    const target = path.join(LOCAL_UPLOADS_DIR, stored);
    writeFileSync(target, "%PDF-1.4 e2e seed file");
    writtenLocalFiles.add(target);
  }
  const [row] = await queryRows<{ id: string }>(
    `insert into client_files (client_id, filename, original_name, title, mime_type, size, category, allocation_type, allocation_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [
      clientId,
      filename,
      opts.name,
      opts.title ?? null,
      opts.mimeType ?? "application/pdf",
      opts.size ?? 240_000,
      opts.category ?? null,
      link?.type ?? null,
      link?.id ?? null,
    ],
  );
  return row.id;
}

export interface SeedPassengerOptions {
  isLead?: boolean;
  firstName?: string;
  surname?: string;
  /** YYYY-MM-DD */
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportIssueDate?: string;
  nationality?: string;
  sex?: "M" | "F" | "X";
}

/** A passenger row on the client. The lead row only carries passport details (its name comes from the client). */
export async function seedPortalPassenger(clientId: string, opts: SeedPassengerOptions = {}): Promise<string> {
  const [row] = await queryRows<{ id: string }>(
    `insert into client_passenger (client_id, is_lead, first_name, surname, date_of_birth, passport_number, passport_expiry, passport_issue_date, nationality, sex)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [
      clientId,
      opts.isLead ?? false,
      opts.firstName ?? "",
      opts.surname ?? "",
      opts.dateOfBirth ?? null,
      opts.passportNumber ?? null,
      opts.passportExpiry ?? null,
      opts.passportIssueDate ?? null,
      opts.nationality ?? null,
      opts.sex ?? null,
    ],
  );
  return row.id;
}

/** A tiny valid PNG, for the photo picker. */
export const PASSPORT_PHOTO = {
  name: "passport.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

/** What the (stubbed) read endpoint answers for a clear photo of Emma's passport. */
export const EMMA_READ: PortalPassportReadResult = {
  surname: "BOUY",
  givenNames: "EMMA",
  nationality: "BRITISH CITIZEN",
  dateOfBirth: "1990-03-03",
  sex: "F",
  passportNumber: "548193027",
  dateOfIssue: "2022-10-22",
  expiryDate: "2032-10-22",
  mrzVerified: true,
};

/** Stubs POST /passports/read with a result. Returns how many times it was asked. */
export async function stubPassportRead(page: Page, result: PortalPassportReadResult = EMMA_READ): Promise<{ calls: () => number }> {
  let calls = 0;
  await page.route("**/api/v2/portal/passports/read", async (route) => {
    calls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  return { calls: () => calls };
}

/** Stubs POST /passports/read with a failure the server can give (422 UNREADABLE, 429 RATE_LIMITED, 503 UNAVAILABLE...). */
export async function stubPassportReadFailure(page: Page, status: number, code: string, error: string): Promise<void> {
  await page.route("**/api/v2/portal/passports/read", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error, code }) }),
  );
}

/** Every response body the page receives from the portal API, except the read endpoint (whose answer is the customer's own photo). */
export function recordPortalBodies(page: Page): { bodies: () => string[] } {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/api/") || url.includes("/portal/passports/read")) return;
    try {
      bodies.push(await res.text());
    } catch {
      /* a redirect or a closed page has no body */
    }
  });
  return { bodies: () => bodies };
}
