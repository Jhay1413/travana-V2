/** Pure helpers for scripts/migrate-homeworker-branches.ts (no DB access), kept separate so they can be unit tested. */

export interface CliOptions {
  apply: boolean;
  force: boolean;
  orgId: string | null;
  confirmDb: string | null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { apply: false, force: false, orgId: null, confirmDb: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--apply":
        options.apply = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--org": {
        const value = argv[++i];
        if (!value || !UUID_RE.test(value)) throw new Error("--org requires an organization uuid");
        options.orgId = value;
        break;
      }
      case "--confirm-db": {
        const value = argv[++i];
        if (!value) throw new Error("--confirm-db requires the database name");
        options.confirmDb = value;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.force && !options.apply) throw new Error("--force only makes sense with --apply");
  return options;
}

/** Host and database name only; credentials are never included. */
export function maskDatabaseUrl(rawUrl: string): string {
  let raw = rawUrl;
  if (raw.startsWith("psql ")) raw = raw.replace(/^psql\s+'?/, "").replace(/'$/, "");
  try {
    const url = new URL(raw);
    return `host=${url.hostname} database=${url.pathname.replace(/^\//, "") || "(none)"}`;
  } catch {
    return "host/database unknown (DATABASE_URL could not be parsed)";
  }
}

/** Throws (so the org transaction rolls back) when a statement touched an unexpected number of rows. */
export function expectCount(actual: number, expected: number, what: string): void {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${expected} row(s) but ${actual} were affected; rolling back this org.`);
  }
}

export type OrgOutcomeStatus = "planned" | "committed" | "refused" | "failed" | "nothing";

export interface OrgOutcome {
  orgId: string;
  name: string;
  status: OrgOutcomeStatus;
  detail?: string;
}

/**
 * Runs `runOne` for every org. An error in one org is caught, logged with the org id and name,
 * and recorded as "failed"; the remaining orgs still run.
 */
export async function runPerOrg(
  orgs: Array<{ id: string; name: string }>,
  runOne: (org: { id: string; name: string }) => Promise<{ status: OrgOutcomeStatus; detail?: string }>,
  log: (message: string) => void = console.error,
): Promise<OrgOutcome[]> {
  const outcomes: OrgOutcome[] = [];
  for (const org of orgs) {
    try {
      outcomes.push({ orgId: org.id, name: org.name, ...(await runOne(org)) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`FAILED org ${org.id} (${org.name}): ${message}`);
      outcomes.push({ orgId: org.id, name: org.name, status: "failed", detail: message });
    }
  }
  return outcomes;
}

export function summariseOutcomes(outcomes: OrgOutcome[]): Record<OrgOutcomeStatus, number> {
  const out: Record<OrgOutcomeStatus, number> = { planned: 0, committed: 0, refused: 0, failed: 0, nothing: 0 };
  for (const o of outcomes) out[o.status] += 1;
  return out;
}

/** Exit code: 1 if any org failed, 2 if an apply refused an org, else 0 (a dry run is always 0). */
export function exitCodeFor(outcomes: OrgOutcome[], apply: boolean): number {
  const counts = summariseOutcomes(outcomes);
  if (counts.failed > 0) return 1;
  if (apply && counts.refused > 0) return 2;
  return 0;
}
