import { resolveOrCreateByDetails, type OnboardingResolution } from "../sendseven-webhook/identity.service";
import type { InsertClientTable } from "@shared/schema";

// Identity resolution for the internal test-flow driver (Goal B). Unlike the
// SendSeven worker (identity.service.ts), there is no real contact to link —
// the "customer" is a SYNTHETIC client the tester types in themselves, so we
// only need to find-or-create a CRM client and hand back its id. The actual
// matching/creation is DELEGATED to identity.service so the test flow gets the
// same NAME-AWARE allocation (and phone-conflict detection) as the real
// SendSeven flow — it previously took matches[0] blindly, which silently linked
// a differently-named tester to an existing client on that number.

// Tags every test-flow-created client so it's obviously synthetic in any
// client list/search (mirrors how enquiry-auto-create tags the transaction
// with is_test).
const TEST_CLIENT_BADGE = "TEST";

export interface TestClientDetails {
  fullName: string;
  phone: string;
}

function testClientColumns(orgId: string, staffUserId: string | null): Partial<InsertClientTable> {
  return { badge: TEST_CLIENT_BADGE, createdBy: staffUserId, orgId } as Partial<InsertClientTable>;
}

// Name-aware find-or-create for the test flow: picks the client on that number
// whose NAME matches, else creates a new synthetic TEST client owned by the
// staff member running the test. A number already held by a differently-named
// client yields a fresh client too, reported via `duplicatePhoneNames` — see
// resolveOrCreateByDetails.
export async function resolveOrCreateTestClient(
  orgId: string,
  staffUserId: string | null,
  details: TestClientDetails,
): Promise<OnboardingResolution> {
  return resolveOrCreateByDetails(orgId, details, testClientColumns(orgId, staffUserId));
}
