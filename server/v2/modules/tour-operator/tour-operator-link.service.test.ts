import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./org-tour-operator.repository", () => ({
  orgTourOperatorRepository: { findLinkedOperatorIds: vi.fn(), ensureLink: vi.fn(), listForOrg: vi.fn() },
}));

import { matchLinkedOperator, tourOperatorLinkService } from "./tour-operator-link.service";
import { orgTourOperatorRepository as links } from "./org-tour-operator.repository";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.resetAllMocks());

describe("assertOperatorsLinked", () => {
  it("passes when every id is linked, querying once for the unique ids", async () => {
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([A, B]);
    await expect(tourOperatorLinkService.assertOperatorsLinked({ orgId: "o1" }, [A, B, A])).resolves.toBeUndefined();
    expect(links.findLinkedOperatorIds).toHaveBeenCalledWith("o1", [A, B]);
  });

  it("400s with the user-facing message when an id is not linked", async () => {
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([A]);
    await expect(tourOperatorLinkService.assertOperatorsLinked({ orgId: "o1" }, [A, B])).rejects.toMatchObject({
      statusCode: 400,
      message: "Tour operator is not in your list",
    });
  });

  it("skips ids already on the record and does not query when nothing is left", async () => {
    await tourOperatorLinkService.assertOperatorsLinked({ orgId: "o1" }, [A], [A.toUpperCase()]);
    expect(links.findLinkedOperatorIds).not.toHaveBeenCalled();
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([B]);
    await tourOperatorLinkService.assertOperatorsLinked({ orgId: "o1" }, [A, B], [A]);
    expect(links.findLinkedOperatorIds).toHaveBeenCalledWith("o1", [B]);
  });

  it("is a no-op for an empty id list and for a trusted call without an org", async () => {
    await tourOperatorLinkService.assertOperatorsLinked({ orgId: "o1" }, []);
    await tourOperatorLinkService.assertOperatorsLinked({ orgId: "" }, [A]);
    expect(links.findLinkedOperatorIds).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without hitting the database", async () => {
    await expect(tourOperatorLinkService.assertOperatorsLinked({ orgId: "o1" }, ["not-a-uuid"])).rejects.toMatchObject({ statusCode: 400 });
    expect(links.findLinkedOperatorIds).not.toHaveBeenCalled();
  });
});

describe("assertPayloadOperatorsLinked", () => {
  it("collects ids from the payload and exempts the ones loaded from the record", async () => {
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([A]);
    const load = vi.fn().mockResolvedValue([B]);
    await tourOperatorLinkService.assertPayloadOperatorsLinked(
      { orgId: "o1" },
      { main_tour_operator_id: A, flights: [{ tour_operator_id: B }] },
      load,
    );
    expect(links.findLinkedOperatorIds).toHaveBeenCalledWith("o1", [A]);
  });

  it("rejects an unlinked id that is not on the record", async () => {
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([]);
    await expect(
      tourOperatorLinkService.assertPayloadOperatorsLinked({ orgId: "o1" }, { main_tour_operator_id: A }, async () => []),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not load the record when the payload has no operators or the call is trusted", async () => {
    const load = vi.fn().mockResolvedValue([]);
    await tourOperatorLinkService.assertPayloadOperatorsLinked({ orgId: "o1" }, { title: "x" }, load);
    await tourOperatorLinkService.assertPayloadOperatorsLinked({ orgId: null }, { main_tour_operator_id: A }, load);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("matchLinkedOperator / findLinkedOperatorByName", () => {
  const ops = [{ id: "1", name: "Jet2 Holidays" }, { id: "2", name: "TUI" }, { id: "3", name: "TUI Cruises" }];

  it("prefers an exact match, accepts a unique contains match, rejects an ambiguous one", () => {
    expect(matchLinkedOperator(ops, "tui")?.id).toBe("2");
    expect(matchLinkedOperator(ops, "Jet2")?.id).toBe("1");
    expect(matchLinkedOperator(ops, "T")).toBeNull();
    expect(matchLinkedOperator(ops, "  ")).toBeNull();
    expect(matchLinkedOperator(ops, "nothing")).toBeNull();
  });

  it("searches the org's own links, active or not", async () => {
    vi.mocked(links.listForOrg).mockResolvedValue([{ operatorId: "1", name: "Jet2 Holidays" }] as never);
    expect(await tourOperatorLinkService.findLinkedOperatorByName("o1", "Jet2")).toEqual({ id: "1", name: "Jet2 Holidays" });
    expect(links.listForOrg).toHaveBeenCalledWith("o1", true);
  });
});

describe("isOperatorLinked", () => {
  it("is true only when the org has a link", async () => {
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([A]);
    expect(await tourOperatorLinkService.isOperatorLinked("o1", A)).toBe(true);
    vi.mocked(links.findLinkedOperatorIds).mockResolvedValue([]);
    expect(await tourOperatorLinkService.isOperatorLinked("o1", A)).toBe(false);
  });
});

describe("ensureLinkForOrg", () => {
  it("delegates to the repository", async () => {
    vi.mocked(links.ensureLink).mockResolvedValue({ created: true, linkId: "l1" });
    expect(await tourOperatorLinkService.ensureLinkForOrg("o1", A, "u1")).toEqual({ created: true, linkId: "l1" });
    expect(links.ensureLink).toHaveBeenCalledWith("o1", A, "u1", null);
    await tourOperatorLinkService.ensureLinkForOrg("o1", A, "u1", "12.50");
    expect(links.ensureLink).toHaveBeenLastCalledWith("o1", A, "u1", "12.50");
  });
});
