import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./booking-upsell.repository", () => ({
  bookingUpsellRepository: { create: vi.fn(), update: vi.fn(), findById: vi.fn(), findByBooking: vi.fn(), softDelete: vi.fn() },
}));
vi.mock("./booking.repository", () => ({
  bookingRepository: { bookingInScope: vi.fn(), findById: vi.fn() },
}));
vi.mock("../tour-operator/tour-operator-link.service", () => ({
  tourOperatorLinkService: { assertOperatorsLinked: vi.fn() },
}));

import { bookingUpsellService } from "./booking-upsell.service";
import { bookingUpsellRepository } from "./booking-upsell.repository";
import { bookingRepository } from "./booking.repository";
import { tourOperatorLinkService } from "../tour-operator/tour-operator-link.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const SCOPE = {
  orgId: "o1",
  branchId: null,
  orgRole: "org_admin",
  orgRoles: ["org_admin"],
  userId: "u1",
  branchType: null,
  ownsHomeworkerBranch: false,
} as Scope;
const OP_A = "11111111-1111-4111-8111-111111111111";
const OP_B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(bookingRepository.bookingInScope).mockResolvedValue(true);
  vi.mocked(bookingRepository.findById).mockResolvedValue({ id: "b1", is_active: true } as never);
  vi.mocked(bookingUpsellRepository.create).mockResolvedValue({ id: "up1" } as never);
  vi.mocked(bookingUpsellRepository.update).mockResolvedValue({ id: "up1" } as never);
});

describe("bookingUpsellService.create - operator check", () => {
  it("checks the chosen operator against the org's list before writing", async () => {
    await bookingUpsellService.create("b1", { upsell_type: "FEE", tour_operator_id: OP_A } as never, SCOPE);
    expect(tourOperatorLinkService.assertOperatorsLinked).toHaveBeenCalledWith(SCOPE, [OP_A]);
    expect(bookingUpsellRepository.create).toHaveBeenCalledOnce();
  });

  it("does not write when the operator is not linked", async () => {
    vi.mocked(tourOperatorLinkService.assertOperatorsLinked).mockRejectedValue(new AppError("Tour operator is not in your list", 400));
    await expect(
      bookingUpsellService.create("b1", { upsell_type: "FEE", tour_operator_id: OP_A } as never, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(bookingUpsellRepository.create).not.toHaveBeenCalled();
  });

  it("skips the check when no operator is chosen", async () => {
    await bookingUpsellService.create("b1", { upsell_type: "FEE" } as never, SCOPE);
    expect(tourOperatorLinkService.assertOperatorsLinked).not.toHaveBeenCalled();
  });
});

describe("bookingUpsellService.update - operator check", () => {
  beforeEach(() => {
    vi.mocked(bookingUpsellRepository.findById).mockResolvedValue({
      id: "up1", booking_id: "b1", is_active: true, tour_operator_id: OP_A,
    } as never);
  });

  it("checks only a CHANGED operator", async () => {
    await bookingUpsellService.update("up1", { tour_operator_id: OP_B }, SCOPE);
    expect(tourOperatorLinkService.assertOperatorsLinked).toHaveBeenCalledWith(SCOPE, [OP_B]);
  });

  it("lets an unchanged operator through without a lookup, and clearing it is always fine", async () => {
    await bookingUpsellService.update("up1", { tour_operator_id: OP_A }, SCOPE);
    await bookingUpsellService.update("up1", { tour_operator_id: null }, SCOPE);
    expect(tourOperatorLinkService.assertOperatorsLinked).not.toHaveBeenCalled();
  });

  it("does not update when the new operator is rejected", async () => {
    vi.mocked(tourOperatorLinkService.assertOperatorsLinked).mockRejectedValue(new AppError("Tour operator is not in your list", 400));
    await expect(bookingUpsellService.update("up1", { tour_operator_id: OP_B }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(bookingUpsellRepository.update).not.toHaveBeenCalled();
  });
});
