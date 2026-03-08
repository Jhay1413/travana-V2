import { Router, Request, Response } from "express";
import { destinationGuruService } from "../services/destination-guru.service";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const destinations = await destinationGuruService.getAll();
    res.json({ success: true, data: destinations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/search/:destination", async (req: Request, res: Response) => {
  try {
    const destination = await destinationGuruService.getByDestination(req.params.destination);
    if (!destination) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }
    res.json({ success: true, data: destination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { destination } = req.body;
    if (!destination || typeof destination !== "string" || destination.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Destination is required" });
    }
    const userId = (req as any).user?.id || null;
    const result = await destinationGuruService.generate(destination.trim(), userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await destinationGuruService.remove(req.params.id);
    res.json({ success: true, message: "Destination removed" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const destination = await destinationGuruService.getById(req.params.id);
    if (!destination) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }
    res.json({ success: true, data: destination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
