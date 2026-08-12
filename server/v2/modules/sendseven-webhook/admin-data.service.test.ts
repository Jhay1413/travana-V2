import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the pieces getEnquiries touches are mocked — the point of these tests is
// the callback lookup that lets the admin bot answer "any update?" with the
// real time a colleague is booked to ring.

vi.mock("../ticket/ticket.service", () => ({ ticketService: { listTicketsByClient: vi.fn() } }));
vi.mock("../ticket/ticket-attachment.service", () => ({ ticketAttachmentService: {} }));
vi.mock("../client/client-file.service", () => ({ clientFileService: { listByClientId: vi.fn(), getDownloadTarget: vi.fn() } }));
vi.mock("../branch-member/branch-member.repository", () => ({ branchMemberRepository: {} }));
vi.mock("../internal-chat/internal-chat-clients.repository", () => ({
  internalChatClientsRepository: { getClientEnquiryDetails: vi.fn(), getClientQuoteDetails: vi.fn() },
}));
vi.mock("../task/task.service", () => ({ taskService: { listByEntity: vi.fn() } }));
vi.mock("./identity.service", () => ({ systemScope: vi.fn((orgId: string) => ({ orgId })) }));

import { adminDataService } from "./admin-data.service";
import { internalChatClientsRepository } from "../internal-chat/internal-chat-clients.repository";
import { taskService } from "../task/task.service";

const ORG = "org-1";
const CLIENT = "client-1";

const enquiryRow = {
  id: "enq-1",
  title: "Albufeira Summer",
  status: "New",
  holidayTypeName: "Package Holiday",
  destinations: ["Albufeira"],
  travelDate: "2026-08-14",
  adults: 3,
  children: 0,
  infants: 0,
  budget: null,
  dateCreated: new Date("2026-08-06T10:00:00Z"),
};

// 11:30 UK on a summer date (BST) — the shape the AI books callbacks in.
const futureDue = new Date("2027-08-06T10:30:00.000Z");
const pastDue = new Date("2020-01-01T09:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(internalChatClientsRepository.getClientEnquiryDetails).mockResolvedValue({ rows: [enquiryRow] } as never);
  vi.mocked(taskService.listByEntity).mockResolvedValue([] as never);
});

describe("adminDataService.getEnquiries — outstanding callback", () => {
  it("reports the booked call in UK wall-clock terms", async () => {
    vi.mocked(taskService.listByEntity).mockResolvedValue([
      { id: "t1", completed: false, dueDate: futureDue },
    ] as never);

    const [enquiry] = await adminDataService.getEnquiries(ORG, CLIENT);

    expect(taskService.listByEntity).toHaveBeenCalledWith("enquiry", "enq-1", expect.objectContaining({ orgId: ORG }));
    // 10:30 UTC in August is 11:30 in London — the time the customer was told.
    expect(enquiry.scheduledCall).toContain("11:30");
    expect(enquiry.scheduledCall).toContain("BST");
  });

  it("ignores a call that has already passed — they're chasing because it didn't happen", async () => {
    vi.mocked(taskService.listByEntity).mockResolvedValue([{ id: "t1", completed: false, dueDate: pastDue }] as never);

    const [enquiry] = await adminDataService.getEnquiries(ORG, CLIENT);

    expect(enquiry.scheduledCall).toBeNull();
  });

  it("ignores a call already completed, and undated tasks", async () => {
    vi.mocked(taskService.listByEntity).mockResolvedValue([
      { id: "t1", completed: true, dueDate: futureDue },
      { id: "t2", completed: false, dueDate: null },
    ] as never);

    const [enquiry] = await adminDataService.getEnquiries(ORG, CLIENT);

    expect(enquiry.scheduledCall).toBeNull();
  });

  it("picks the soonest upcoming call when several are booked", async () => {
    vi.mocked(taskService.listByEntity).mockResolvedValue([
      { id: "late", completed: false, dueDate: new Date("2027-08-09T14:00:00.000Z") },
      { id: "soon", completed: false, dueDate: new Date("2027-08-06T08:00:00.000Z") },
    ] as never);

    const [enquiry] = await adminDataService.getEnquiries(ORG, CLIENT);

    expect(enquiry.scheduledCall).toContain("09:00"); // 08:00 UTC → 09:00 BST
  });

  it("still returns the enquiry when the callback lookup fails", async () => {
    vi.mocked(taskService.listByEntity).mockRejectedValue(new Error("db down"));

    const [enquiry] = await adminDataService.getEnquiries(ORG, CLIENT);

    expect(enquiry.title).toBe("Albufeira Summer");
    expect(enquiry.scheduledCall).toBeNull();
  });
});
