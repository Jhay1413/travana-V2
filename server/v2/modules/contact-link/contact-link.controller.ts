import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { contactLinkService } from "./contact-link.service";

// HTTP layer for linking a SendSeven contact to a CRM client. All actions are
// org-scoped via getScope(req) (orgBranchScope must have run).

export const contactLinkController = {
  // GET /api/v2/contact-links/:contactId?phone=&email=
  getStatus: asyncHandler(async (req: Request, res: Response) => {
    const contactId = req.params.contactId as string;
    const phone = (req.query.phone as string) || undefined;
    const email = (req.query.email as string) || undefined;
    const status = await contactLinkService.getStatus(contactId, { phone, email }, getScope(req));
    return successResponse(res, status, "Contact link status");
  }),

  // GET /api/v2/contact-links/by-client/:clientId
  getByClient: asyncHandler(async (req: Request, res: Response) => {
    const clientId = req.params.clientId as string;
    const link = await contactLinkService.getByClient(clientId, getScope(req));
    return successResponse(res, link, "Client contact link");
  }),

  // PUT /api/v2/contact-links/:contactId  { clientId }
  link: asyncHandler(async (req: Request, res: Response) => {
    const contactId = req.params.contactId as string;
    const { clientId } = req.body as { clientId: string };
    const client = await contactLinkService.link(contactId, clientId, getScope(req));
    return successResponse(res, client, "Contact linked to client");
  }),

  // POST /api/v2/contact-links/:contactId/client  { firstName, surename, phoneNumber, ... }
  createAndLink: asyncHandler(async (req: Request, res: Response) => {
    const contactId = req.params.contactId as string;
    const client = await contactLinkService.createAndLink(contactId, req.body, getScope(req));
    return successResponse(res, client, "Client created and linked", 201);
  }),

  // DELETE /api/v2/contact-links/:contactId
  unlink: asyncHandler(async (req: Request, res: Response) => {
    await contactLinkService.unlink(req.params.contactId as string, getScope(req));
    return successResponse(res, { ok: true }, "Contact unlinked");
  }),
};
