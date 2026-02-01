import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
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
} from "@shared/schema";

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

  return httpServer;
}
