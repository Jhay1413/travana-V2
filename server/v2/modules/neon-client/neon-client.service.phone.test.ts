import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./neon-client.repository", () => ({
  neonClientRepository: { create: vi.fn(), update: vi.fn(), findById: vi.fn() },
}));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../client/client.repository", () => ({
  clientRepository: { create: vi.fn(), update: vi.fn(), findById: vi.fn() },
}));

import { neonClientService } from "./neon-client.service";
import { neonClientRepository } from "./neon-client.repository";
import { clientService } from "../client/client.service";
import { clientRepository } from "../client/client.repository";
import { createNeonClientValidator } from "./neon-client.validator";
import { validate } from "../../middlewares/validation.middleware";
import type { Request, Response } from "express";

const AGENT = { orgId: "o1", orgRole: "agent", userId: "u1" } as never;

beforeEach(() => vi.clearAllMocks());

describe("phone number is stored trimmed", () => {
  it("neon create", async () => {
    vi.mocked(neonClientRepository.create).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.createNeonClient({ firstName: "A", phoneNumber: "  07123456789 " } as never, AGENT);
    expect(vi.mocked(neonClientRepository.create).mock.calls[0][0]).toMatchObject({ phoneNumber: "07123456789" });
  });

  it("neon update", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "active" } as never);
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.updateNeonClient("c1", { phoneNumber: " 07123456789 " } as never, AGENT);
    expect(vi.mocked(neonClientRepository.update).mock.calls[0][1]).toMatchObject({ phoneNumber: "07123456789" });
  });

  it("v2 create and update", async () => {
    vi.mocked(clientRepository.create).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(clientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await clientService.createClient({ firstName: "A", phoneNumber: " 07123456789 " } as never, AGENT);
    await clientService.updateClient("c1", { phoneNumber: " 07123456789 " } as never, AGENT);
    expect(vi.mocked(clientRepository.create).mock.calls[0][0]).toMatchObject({ phoneNumber: "07123456789" });
    expect(vi.mocked(clientRepository.update).mock.calls[0][1]).toMatchObject({ phoneNumber: "07123456789" });
  });
});

describe("the 400 message is the phone message", () => {
  it("a padded valid number passes validation; a bad one 400s with the message the UI shows", async () => {
    const run = async (phoneNumber: string) => {
      const next = vi.fn();
      await validate(createNeonClientValidator)(
        { body: { firstName: "A", surename: "B", phoneNumber }, query: {}, params: {} } as Request,
        {} as Response,
        next,
      );
      return next.mock.calls[0]?.[0] as { statusCode: number; message: string } | undefined;
    };
    expect(await run("  07123456789  ")).toBeUndefined();
    expect(await run("1".repeat(30))).toMatchObject({ statusCode: 400, message: expect.stringContaining("valid phone number") });
  });
});
