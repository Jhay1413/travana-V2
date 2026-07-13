import { neonClientService } from "../neon-client/neon-client.service";
import { systemScope } from "../sendseven-webhook/identity.service";
import type { InsertClientTable } from "@shared/schema";

// Identity resolution for the internal test-flow driver (Goal B). Unlike the
// SendSeven worker (identity.service.ts), there is no real contact to link —
// the "customer" is a SYNTHETIC client the tester types in themselves, so we
// only need to find-or-create a CRM client and hand back its id. DB access
// stays inside neonClientService/neonClientRepository — this just orchestrates.

// Tags every test-flow-created client so it's obviously synthetic in any
// client list/search (mirrors how enquiry-auto-create tags the transaction
// with is_test).
const TEST_CLIENT_BADGE = "TEST";

export interface TestClientDetails {
  fullName: string;
  phone: string;
}

// Finds an existing client by phone (so re-running the test flow with the
// same phone number exercises the phone-linking path instead of piling up
// duplicates), else creates a new synthetic client owned by the staff member
// running the test. Returns the client id.
export async function resolveOrCreateTestClient(
  orgId: string,
  staffUserId: string | null,
  details: TestClientDetails,
): Promise<string> {
  const scope = systemScope(orgId);

  const matches = await neonClientService.findMatches({ phone: details.phone }, scope);
  if (matches.length > 0) return matches[0]!.id;

  const parts = details.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || details.fullName.trim();
  const surename = parts.slice(1).join(" ") || "—";
  const data: InsertClientTable = {
    firstName,
    surename,
    phoneNumber: details.phone,
    badge: TEST_CLIENT_BADGE,
    createdBy: staffUserId,
    orgId,
  } as InsertClientTable;

  const client = await neonClientService.createNeonClient(data, scope);
  return client.id;
}
