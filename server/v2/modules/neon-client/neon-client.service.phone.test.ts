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
import { createNeonClientValidator, updateNeonClientValidator } from "./neon-client.validator";
import { validate } from "../../middlewares/validation.middleware";
import { PHONE_ERROR_MESSAGE } from "@shared/phone";
import type { Request, Response } from "express";

const AGENT = { orgId: "o1", orgRole: "agent", userId: "u1" } as never;
const LEGACY = "+1 415 555 2671";

beforeEach(() => vi.clearAllMocks());

describe("phone number is stored in the 11-digit form", () => {
  it("neon create normalises +44 and spacing", async () => {
    vi.mocked(neonClientRepository.create).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.createNeonClient({ firstName: "A", phoneNumber: " +44 7123 456789 " } as never, AGENT);
    expect(vi.mocked(neonClientRepository.create).mock.calls[0][0]).toMatchObject({ phoneNumber: "07123456789" });
  });

  it("neon update normalises a changed phone", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "active", phoneNumber: "07000000000" } as never);
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.updateNeonClient("c1", { phoneNumber: "07123 456789" } as never, AGENT);
    expect(vi.mocked(neonClientRepository.update).mock.calls[0][1]).toMatchObject({ phoneNumber: "07123456789" });
  });

  it("v2 create and update", async () => {
    vi.mocked(clientRepository.create).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(clientRepository.findById).mockResolvedValue({ id: "c1", phoneNumber: "07000000000" } as never);
    vi.mocked(clientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await clientService.createClient({ firstName: "A", phoneNumber: "07123 456789" } as never, AGENT);
    await clientService.updateClient("c1", { phoneNumber: "0044 7123 456789" } as never, AGENT);
    expect(vi.mocked(clientRepository.create).mock.calls[0][0]).toMatchObject({ phoneNumber: "07123456789" });
    expect(vi.mocked(clientRepository.update).mock.calls[0][1]).toMatchObject({ phoneNumber: "07123456789" });
  });
});

describe("phone rule on edit applies only when new or changed", () => {
  it("neon: a changed bad phone is a 400", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "active", phoneNumber: "07000000000" } as never);
    await expect(neonClientService.updateNeonClient("c1", { phoneNumber: "12345" } as never, AGENT)).rejects.toMatchObject({
      statusCode: 400,
      message: PHONE_ERROR_MESSAGE,
    });
    expect(neonClientRepository.update).not.toHaveBeenCalled();
  });

  it("neon: an unchanged legacy phone is saved as-is", async () => {
    vi.mocked(neonClientRepository.findById).mockResolvedValue({ id: "c1", status: "active", phoneNumber: LEGACY } as never);
    vi.mocked(neonClientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await neonClientService.updateNeonClient("c1", { phoneNumber: LEGACY, firstName: "B" } as never, AGENT);
    expect(vi.mocked(neonClientRepository.update).mock.calls[0][1]).toMatchObject({ phoneNumber: LEGACY, firstName: "B" });
  });

  it("v2: a changed foreign phone is a 400; an unchanged legacy phone passes", async () => {
    vi.mocked(clientRepository.findById).mockResolvedValue({ id: "c1", phoneNumber: LEGACY } as never);
    vi.mocked(clientRepository.update).mockResolvedValue({ id: "c1" } as never);
    await expect(clientService.updateClient("c1", { phoneNumber: "+34 612 345 678" } as never, AGENT)).rejects.toMatchObject({
      statusCode: 400,
    });
    await clientService.updateClient("c1", { phoneNumber: LEGACY } as never, AGENT);
    expect(vi.mocked(clientRepository.update).mock.calls[0][1]).toMatchObject({ phoneNumber: LEGACY });
  });
});

describe("the 400 message is the phone message", () => {
  const run = async (schema: Parameters<typeof validate>[0], body: Record<string, unknown>) => {
    const next = vi.fn();
    await validate(schema)(
      { body, query: {}, params: { id: "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11" } } as unknown as Request,
      {} as Response,
      next,
    );
    return next.mock.calls[0]?.[0] as { statusCode: number; message: string } | undefined;
  };

  it("create: a padded valid number passes; a bad one 400s with the UI message", async () => {
    expect(await run(createNeonClientValidator, { firstName: "A", surename: "B", phoneNumber: "  07123 456789  " })).toBeUndefined();
    expect(await run(createNeonClientValidator, { firstName: "A", surename: "B", phoneNumber: "1".repeat(30) })).toMatchObject({
      statusCode: 400,
      message: PHONE_ERROR_MESSAGE,
    });
  });

  it("update: a short legacy string passes validation (the service decides on change)", async () => {
    expect(await run(updateNeonClientValidator, { phoneNumber: LEGACY })).toBeUndefined();
  });
});
