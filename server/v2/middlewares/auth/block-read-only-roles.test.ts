import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { stub } = vi.hoisted(() => ({ stub: () => new Proxy({}, { get: () => () => undefined }) }));
vi.mock("../../modules/contact-link/contact-link.controller", () => ({ contactLinkController: stub() }));
vi.mock("../../modules/note/note.controller", () => ({ noteController: stub() }));
vi.mock("../../modules/note/note-attachment.controller", () => ({ noteAttachmentController: stub() }));
vi.mock("../../modules/transaction/transaction.controller", () => ({ transactionController: stub() }));
vi.mock("../../modules/enquiry/enquiry.controller", () => ({ enquiryController: stub() }));
vi.mock("../../modules/booking/booking.controller", () => ({ bookingController: stub() }));
vi.mock("../../modules/booking/booking-image.controller", () => ({ bookingImageController: stub() }));
vi.mock("../../modules/booking/booking-upsell.controller", () => ({ bookingUpsellController: stub() }));
vi.mock("../../modules/task/task.controller", () => ({ taskController: stub() }));
vi.mock("../../modules/ticket/ticket.controller", () => ({ ticketController: stub() }));
vi.mock("../../modules/ticket/ticket-attachment.controller", () => ({ ticketAttachmentController: stub() }));
vi.mock("../../modules/ticket/ticket-reply.controller", () => ({ ticketReplyController: stub() }));
vi.mock("../../modules/ai-enquiry/ai-enquiry.controller", () => ({ aiEnquiryController: stub() }));
vi.mock("../../modules/quote/quote.controller", () => ({ quoteController: stub() }));
vi.mock("../../modules/quote/quote-image.controller", () => ({ quoteImageController: stub() }));
vi.mock("../../modules/quote/quote.service", () => ({ newQuoteService: { isFreeQuote: vi.fn() } }));
vi.mock("../../modules/social-post/social-post.controller", () => ({ socialPostController: stub() }));
vi.mock("../../modules/social-settings/social-settings.controller", () => ({ socialSettingsController: stub() }));
vi.mock("../../modules/sms/sms.controller", () => ({ smsController: stub() }));
vi.mock("./index", () => ({ isAuthenticated: vi.fn() }));
vi.mock("../auth", () => ({ isAuthenticated: vi.fn() }));
vi.mock("../org-branch-scope", () => ({ orgBranchScope: vi.fn() }));

import { blockReadOnlyClientWrites, blockReadOnlyClientRoles } from "./block-read-only-roles";
import contactLink from "../../modules/contact-link/contact-link.routes";
import note from "../../modules/note/note.routes";
import noteAttachment from "../../modules/note/note-attachment.routes";
import transaction from "../../modules/transaction/transaction.routes";
import enquiry from "../../modules/enquiry/enquiry.routes";
import booking from "../../modules/booking/booking.routes";
import upsell from "../../modules/booking/booking-upsell.routes";
import task from "../../modules/task/task.routes";
import ticket from "../../modules/ticket/ticket.routes";
import ticketAttachment from "../../modules/ticket/ticket-attachment.routes";
import ticketReply from "../../modules/ticket/ticket-reply.routes";
import aiEnquiry from "../../modules/ai-enquiry/ai-enquiry.routes";
import socialPost from "../../modules/social-post/social-post.routes";
import socialSettings from "../../modules/social-settings/social-settings.routes";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
interface Layer {
  handle: Handler;
  route?: { path: string; methods: Record<string, boolean> };
}
const stackOf = (router: unknown) => (router as { stack: Layer[] }).stack;

function call(handler: Handler, method: string, orgRole: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  handler({ method, orgRole } as Request, res as unknown as Response, next);
  return { res, next };
}

describe("blockReadOnlyClientWrites", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("refuses %s for social_media_manager", (method) => {
    const { res, next } = call(blockReadOnlyClientWrites, method, "social_media_manager");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets reads through for social_media_manager and writes for everyone else", () => {
    expect(call(blockReadOnlyClientWrites, "GET", "social_media_manager").next).toHaveBeenCalledOnce();
    for (const role of ["agent", "branch_manager", "org_admin", "homeworker", "platform_admin", ""]) {
      expect(call(blockReadOnlyClientWrites, "PATCH", role).next).toHaveBeenCalledOnce();
    }
  });

  it("unconditional guard refuses even a GET", () => {
    expect(call(blockReadOnlyClientRoles, "GET", "social_media_manager").res.status).toHaveBeenCalledWith(403);
  });
});

describe("every client-data router installs the guard before any route", () => {
  const routers: Array<[string, unknown]> = [
    ["contact-links", contactLink],
    ["notes", note],
    ["note-attachments", noteAttachment],
    ["transactions", transaction],
    ["enquiries", enquiry],
    ["bookings", booking],
    ["upsells", upsell],
    ["tasks", task],
    ["tickets", ticket],
    ["ticket attachments", ticketAttachment],
    ["ticket replies", ticketReply],
    ["ai-enquiry", aiEnquiry],
  ];

  it.each(routers)("%s", (_name, router) => {
    const stack = stackOf(router);
    const guardAt = stack.findIndex((l) => l.handle === blockReadOnlyClientWrites);
    const firstRoute = stack.findIndex((l) => l.route);
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(guardAt).toBeLessThan(firstRoute);
  });
});

describe("social routes stay open to social_media_manager", () => {
  it.each([["social-posts", socialPost], ["social-settings", socialSettings]])("%s", (_name, router) => {
    // Router-level middleware must not refuse the role...
    for (const layer of stackOf(router).filter((l) => !l.route)) {
      const { res, next } = call(layer.handle, "POST", "social_media_manager");
      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    }
    // ...and neither router installs the read-only guard anywhere.
    expect(stackOf(router).some((l) => l.handle === blockReadOnlyClientWrites || l.handle === blockReadOnlyClientRoles)).toBe(false);
  });

  it("social-settings PUT still allows the role", () => {
    const put = stackOf(socialSettings).find((l) => l.route?.path === "/" && l.route.methods.put) as unknown as {
      route: { stack: { handle: Handler }[] };
    };
    const { res, next } = call(put.route.stack[0]!.handle, "PUT", "social_media_manager");
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
