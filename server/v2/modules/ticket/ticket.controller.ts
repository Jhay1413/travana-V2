import { Request, Response } from "express";
import { ticketService } from "./ticket.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";

export const ticketController = {
  listTickets: asyncHandler(async (_req: Request, res: Response) => {
    const tickets = await ticketService.listTickets();
    return successResponse(res, tickets, "Tickets retrieved successfully");
  }),

  getTicketById: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const ticket = await ticketService.getTicketById(id);
    return successResponse(res, ticket, "Ticket retrieved successfully");
  }),

  listTicketsByClient: asyncHandler(async (req: Request, res: Response) => {
    const clientId = req.params.clientId as string;
    const tickets = await ticketService.listTicketsByClient(clientId);
    return successResponse(res, tickets, "Tickets retrieved successfully");
  }),

  listTicketsByUser: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const tickets = await ticketService.listTicketsByUser(userId);
    return successResponse(res, tickets, "Tickets retrieved successfully");
  }),

  createTicket: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await ticketService.createTicket(req.body);
    return successResponse(res, ticket, "Ticket created successfully", 201);
  }),

  updateTicket: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const ticket = await ticketService.updateTicket(id, req.body);
    return successResponse(res, ticket, "Ticket updated successfully");
  }),

  deleteTicket: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await ticketService.deleteTicket(id);
    res.status(204).send();
  }),
};
