import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import {
  insertUserSchema,
  insertClientSchema,
  insertQuoteSchema,
  insertAccommodationSchema,
  insertFlightSchema,
  insertCommissionSchema,
  insertQuoteImageSchema,
  insertNoteSchema,
  insertTourOperatorSchema,
  insertAirportSchema,
  insertTicketSchema,
  insertTicketReplySchema,
  insertClientTableSchema,
  insertNotificationSchema,
} from "@shared/schema";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed"));
  }
};

const upload = multer({
  storage: fileStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper to extract string parameter
function getParam(param: string | string[]): string {
  return typeof param === "string" ? param : param[0];
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication FIRST before other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // ============ Users ============
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.listUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(getParam(req.params.id));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await storage.updateUser(getParam(req.params.id), req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteUser(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ============ Clients ============
  app.get("/api/clients", async (req: Request, res: Response) => {
    try {
      const clients = await storage.listClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const client = await storage.getClient(getParam(req.params.id));
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req: Request, res: Response) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.patch("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const clientData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(getParam(req.params.id), clientData);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.delete("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteClient(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ============ Quotes ============
  app.get("/api/quotes", async (req: Request, res: Response) => {
    try {
      const { status, clientId } = req.query;
      let quotes;
      
      if (status && typeof status === "string") {
        quotes = await storage.listQuotesByStatus(status);
      } else if (clientId && typeof clientId === "string") {
        quotes = await storage.listQuotesByClient(clientId);
      } else {
        quotes = await storage.listQuotes();
      }
      
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const quote = await storage.getQuote(getParam(req.params.id));
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.get("/api/quotes/:id/full", async (req: Request, res: Response) => {
    try {
      const quote = await storage.getQuote(getParam(req.params.id));
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const [accommodation, flights, commission, images, notes, client, owner] = await Promise.all([
        storage.getAccommodationByQuoteId(getParam(req.params.id)),
        storage.listFlightsByQuoteId(getParam(req.params.id)),
        storage.getCommissionByQuoteId(getParam(req.params.id)),
        storage.listQuoteImagesByQuoteId(getParam(req.params.id)),
        storage.listNotesByQuoteId(getParam(req.params.id)),
        storage.getClient(quote.clientId),
        storage.getUser(quote.userId),
      ]);

      res.json({
        ...quote,
        accommodation,
        flights,
        commission,
        images,
        notes,
        client,
        owner,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote details" });
    }
  });

  app.post("/api/quotes", async (req: Request, res: Response) => {
    try {
      const quoteData = insertQuoteSchema.parse(req.body);
      const quote = await storage.createQuote(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      res.status(400).json({ error: "Invalid quote data" });
    }
  });

  app.patch("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const quoteData = insertQuoteSchema.partial().parse(req.body);
      const quote = await storage.updateQuote(getParam(req.params.id), quoteData);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(400).json({ error: "Invalid quote data" });
    }
  });

  app.delete("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteQuote(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // ============ Accommodations ============
  app.get("/api/quotes/:quoteId/accommodation", async (req: Request, res: Response) => {
    try {
      const accommodation = await storage.getAccommodationByQuoteId(getParam(req.params.quoteId));
      if (!accommodation) {
        return res.status(404).json({ error: "Accommodation not found" });
      }
      res.json(accommodation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accommodation" });
    }
  });

  app.post("/api/accommodations", async (req: Request, res: Response) => {
    try {
      const accommodationData = insertAccommodationSchema.parse(req.body);
      const accommodation = await storage.createAccommodation(accommodationData);
      res.status(201).json(accommodation);
    } catch (error) {
      res.status(400).json({ error: "Invalid accommodation data" });
    }
  });

  app.patch("/api/accommodations/:id", async (req: Request, res: Response) => {
    try {
      const accommodationData = insertAccommodationSchema.partial().parse(req.body);
      const accommodation = await storage.updateAccommodation(getParam(req.params.id), accommodationData);
      if (!accommodation) {
        return res.status(404).json({ error: "Accommodation not found" });
      }
      res.json(accommodation);
    } catch (error) {
      res.status(400).json({ error: "Invalid accommodation data" });
    }
  });

  // ============ Flights ============
  app.get("/api/quotes/:quoteId/flights", async (req: Request, res: Response) => {
    try {
      const flights = await storage.listFlightsByQuoteId(getParam(req.params.quoteId));
      res.json(flights);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flights" });
    }
  });

  app.post("/api/flights", async (req: Request, res: Response) => {
    try {
      const flightData = insertFlightSchema.parse(req.body);
      const flight = await storage.createFlight(flightData);
      res.status(201).json(flight);
    } catch (error) {
      res.status(400).json({ error: "Invalid flight data" });
    }
  });

  app.patch("/api/flights/:id", async (req: Request, res: Response) => {
    try {
      const flightData = insertFlightSchema.partial().parse(req.body);
      const flight = await storage.updateFlight(getParam(req.params.id), flightData);
      if (!flight) {
        return res.status(404).json({ error: "Flight not found" });
      }
      res.json(flight);
    } catch (error) {
      res.status(400).json({ error: "Invalid flight data" });
    }
  });

  // ============ Commissions ============
  app.get("/api/quotes/:quoteId/commission", async (req: Request, res: Response) => {
    try {
      const commission = await storage.getCommissionByQuoteId(getParam(req.params.quoteId));
      if (!commission) {
        return res.status(404).json({ error: "Commission not found" });
      }
      res.json(commission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch commission" });
    }
  });

  app.post("/api/commissions", async (req: Request, res: Response) => {
    try {
      const commissionData = insertCommissionSchema.parse(req.body);
      const commission = await storage.createCommission(commissionData);
      res.status(201).json(commission);
    } catch (error) {
      res.status(400).json({ error: "Invalid commission data" });
    }
  });

  app.patch("/api/commissions/:id", async (req: Request, res: Response) => {
    try {
      const commissionData = insertCommissionSchema.partial().parse(req.body);
      const commission = await storage.updateCommission(getParam(req.params.id), commissionData);
      if (!commission) {
        return res.status(404).json({ error: "Commission not found" });
      }
      res.json(commission);
    } catch (error) {
      res.status(400).json({ error: "Invalid commission data" });
    }
  });

  // ============ Quote Images ============
  app.get("/api/quotes/:quoteId/images", async (req: Request, res: Response) => {
    try {
      const images = await storage.listQuoteImagesByQuoteId(getParam(req.params.quoteId));
      res.json(images);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.post("/api/quote-images", async (req: Request, res: Response) => {
    try {
      const imageData = insertQuoteImageSchema.parse(req.body);
      const image = await storage.createQuoteImage(imageData);
      res.status(201).json(image);
    } catch (error) {
      res.status(400).json({ error: "Invalid image data" });
    }
  });

  app.delete("/api/quote-images/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteQuoteImage(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // ============ Notes ============
  app.get("/api/quotes/:quoteId/notes", async (req: Request, res: Response) => {
    try {
      const notes = await storage.listNotesByQuoteId(getParam(req.params.quoteId));
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req: Request, res: Response) => {
    try {
      const noteData = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(noteData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  app.patch("/api/notes/:id", async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      if (typeof content !== "string") {
        return res.status(400).json({ error: "Content must be a string" });
      }
      const note = await storage.updateNote(getParam(req.params.id), content);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  app.delete("/api/notes/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteNote(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // ============ Dashboard Stats ============
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ============ Tour Operators ============
  app.get("/api/tour-operators", async (req: Request, res: Response) => {
    try {
      const operators = await storage.listTourOperators();
      res.json(operators);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tour operators" });
    }
  });

  app.get("/api/tour-operators/:id", async (req: Request, res: Response) => {
    try {
      const operator = await storage.getTourOperator(getParam(req.params.id));
      if (!operator) {
        return res.status(404).json({ error: "Tour operator not found" });
      }
      res.json(operator);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tour operator" });
    }
  });

  app.post("/api/tour-operators", async (req: Request, res: Response) => {
    try {
      const parsed = insertTourOperatorSchema.parse(req.body);
      const operator = await storage.createTourOperator(parsed);
      res.status(201).json(operator);
    } catch (error) {
      res.status(400).json({ error: "Invalid tour operator data" });
    }
  });

  app.patch("/api/tour-operators/:id", async (req: Request, res: Response) => {
    try {
      const operator = await storage.updateTourOperator(getParam(req.params.id), req.body);
      if (!operator) {
        return res.status(404).json({ error: "Tour operator not found" });
      }
      res.json(operator);
    } catch (error) {
      res.status(400).json({ error: "Invalid tour operator data" });
    }
  });

  app.delete("/api/tour-operators/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteTourOperator(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tour operator" });
    }
  });

  // ============ Airports ============
  app.get("/api/airports", async (req: Request, res: Response) => {
    try {
      const airports = await storage.listAirports();
      res.json(airports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch airports" });
    }
  });

  app.post("/api/airports", async (req: Request, res: Response) => {
    try {
      const parsed = insertAirportSchema.parse(req.body);
      const airport = await storage.createAirport(parsed);
      res.status(201).json(airport);
    } catch (error) {
      res.status(400).json({ error: "Invalid airport data" });
    }
  });

  app.delete("/api/airports/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteAirport(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete airport" });
    }
  });

  // ============ Tickets ============
  app.get("/api/tickets", async (req: Request, res: Response) => {
    try {
      const tickets = await storage.listTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", async (req: Request, res: Response) => {
    try {
      const ticket = await storage.getTicket(getParam(req.params.id));
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.get("/api/clients/:clientId/tickets", async (req: Request, res: Response) => {
    try {
      const tickets = await storage.listTicketsByClient(getParam(req.params.clientId));
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client tickets" });
    }
  });

  app.get("/api/users/:userId/tickets", async (req: Request, res: Response) => {
    try {
      const tickets = await storage.listTicketsByUser(getParam(req.params.userId));
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user tickets" });
    }
  });

  app.post("/api/tickets", async (req: Request, res: Response) => {
    try {
      const parsed = insertTicketSchema.parse(req.body);
      const ticket = await storage.createTicket(parsed);
      res.status(201).json(ticket);
    } catch (error) {
      res.status(400).json({ error: "Invalid ticket data" });
    }
  });

  app.patch("/api/tickets/:id", async (req: Request, res: Response) => {
    try {
      const ticket = await storage.updateTicket(getParam(req.params.id), req.body);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      res.status(400).json({ error: "Invalid ticket data" });
    }
  });

  app.delete("/api/tickets/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteTicket(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  // ============ Ticket Attachments ============
  app.get("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
    try {
      const attachments = await storage.listAttachmentsByTicket(getParam(req.params.ticketId));
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.post("/api/tickets/:ticketId/attachments", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const ticketId = getParam(req.params.ticketId);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ error: "Ticket not found" });
      }

      const attachment = await storage.createAttachment({
        ticketId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });

      res.status(201).json(attachment);
    } catch (error) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.get("/api/attachments/:id/download", async (req: Request, res: Response) => {
    try {
      const attachment = await storage.getAttachment(getParam(req.params.id));
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const filePath = path.join(uploadDir, attachment.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${attachment.originalName}"`);
      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.delete("/api/attachments/:id", async (req: Request, res: Response) => {
    try {
      const attachment = await storage.getAttachment(getParam(req.params.id));
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      const filePath = path.join(uploadDir, attachment.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await storage.deleteAttachment(attachment.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // ============ Ticket Replies ============
  app.get("/api/tickets/:ticketId/replies", async (req: Request, res: Response) => {
    try {
      const replies = await storage.listRepliesByTicket(getParam(req.params.ticketId));
      res.json(replies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch replies" });
    }
  });

  app.post("/api/tickets/:ticketId/replies", async (req: Request, res: Response) => {
    try {
      const ticketId = getParam(req.params.ticketId);
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const parsed = insertTicketReplySchema.safeParse({ ...req.body, ticketId });
      if (parsed.success) {
        const reply = await storage.createReply(parsed.data);
        
        if (ticket.userId !== req.body.userId) {
          await storage.createNotification({
            userId: ticket.userId,
            type: "ticket_reply",
            title: "New reply on your ticket",
            message: `Someone replied to "${ticket.subject}"`,
            link: `/tickets?id=${ticketId}`,
            read: false,
          });
        }
        
        res.status(201).json(reply);
      } else {
        res.status(400).json({ error: "Invalid reply data" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to create reply" });
    }
  });

  app.put("/api/replies/:id", async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      const reply = await storage.updateReply(getParam(req.params.id), content);
      if (!reply) {
        return res.status(404).json({ error: "Reply not found" });
      }
      res.json(reply);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reply" });
    }
  });

  app.delete("/api/replies/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteReply(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reply" });
    }
  });

  // ============ Notifications ============
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const notifications = await storage.listNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const notifications = await storage.listUnreadNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.put("/api/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      const notification = await storage.markNotificationRead(getParam(req.params.id));
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/read-all", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string | undefined;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      await storage.markAllNotificationsRead(userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteNotification(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // ========== Neon Client Table Routes ==========

  app.get("/api/neon-clients", async (req: Request, res: Response) => {
    try {
      const clients = await storage.listNeonClients();
      res.json(clients);
    } catch (error) {
      console.error("Failed to list neon clients:", error);
      res.status(500).json({ error: "Failed to list neon clients" });
    }
  });

  app.get("/api/neon-clients/:id", async (req: Request, res: Response) => {
    try {
      const client = await storage.getNeonClient(getParam(req.params.id));
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Failed to get neon client:", error);
      res.status(500).json({ error: "Failed to get neon client" });
    }
  });

  app.post("/api/neon-clients", async (req: Request, res: Response) => {
    try {
      const clientData = insertClientTableSchema.parse(req.body);
      const client = await storage.createNeonClient(clientData);
      res.status(201).json(client);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid client data", details: error.errors });
      }
      console.error("Failed to create neon client:", error);
      res.status(500).json({ error: "Failed to create neon client" });
    }
  });

  app.patch("/api/neon-clients/:id", async (req: Request, res: Response) => {
    try {
      const clientData = insertClientTableSchema.partial().parse(req.body);
      const client = await storage.updateNeonClient(getParam(req.params.id), clientData);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid client data", details: error.errors });
      }
      console.error("Failed to update neon client:", error);
      res.status(500).json({ error: "Failed to update neon client" });
    }
  });

  app.delete("/api/neon-clients/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteNeonClient(getParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete neon client:", error);
      res.status(500).json({ error: "Failed to delete neon client" });
    }
  });

  return httpServer;
}
