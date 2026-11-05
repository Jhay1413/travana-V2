import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../client/client.service", () => ({ clientService: { deleteClient: vi.fn() } }));
vi.mock("./neon-client.repository", () => ({ neonClientRepository: {} }));
vi.mock("../client/client.repository", () => ({ clientRepository: {} }));
vi.mock("../branch/branch.repository", () => ({ branchRepository: {} }));
vi.mock("../sms/sms.service", () => ({ fireAutoTriggerForClient: vi.fn() }));

import { neonClientService } from "./neon-client.service";
import { clientService } from "../client/client.service";

beforeEach(() => vi.clearAllMocks());

describe("neonClientService.deleteNeonClient", () => {
  it("delegates to the single soft-delete implementation (never hard-deletes)", async () => {
    vi.mocked(clientService.deleteClient).mockResolvedValue();
    const scope = { orgId: "o1", orgRole: "org_admin", userId: "u1" } as never;
    await neonClientService.deleteNeonClient("c1", scope);
    expect(clientService.deleteClient).toHaveBeenCalledWith("c1", scope);
  });
});
