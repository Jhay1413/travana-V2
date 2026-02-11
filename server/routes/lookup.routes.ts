import { Router } from "express";
import { db } from "../config/database";
import {
  country,
  destination,
  resorts,
  accomodation_list,
  board_basis,
  park,
  lodges,
  cottages,
  package_type,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/countries", async (_req, res) => {
  try {
    const rows = await db.select().from(country).orderBy(country.country_name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/destinations", async (req, res) => {
  try {
    const countryId = req.query.countryId as string | undefined;
    let query = db.select().from(destination);
    if (countryId) {
      query = query.where(eq(destination.country_id, countryId)) as any;
    }
    const rows = await query.orderBy(destination.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/resorts", async (req, res) => {
  try {
    const destinationId = req.query.destinationId as string | undefined;
    let query = db.select().from(resorts);
    if (destinationId) {
      query = query.where(eq(resorts.destination_id, destinationId)) as any;
    }
    const rows = await query.orderBy(resorts.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/accommodations", async (req, res) => {
  try {
    const resortId = req.query.resortId as string | undefined;
    let query = db.select().from(accomodation_list);
    if (resortId) {
      query = query.where(eq(accomodation_list.resorts_id, resortId)) as any;
    }
    const rows = await query.orderBy(accomodation_list.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/board-basis", async (_req, res) => {
  try {
    const rows = await db.select().from(board_basis).orderBy(board_basis.type);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/parks", async (_req, res) => {
  try {
    const rows = await db.select().from(park).orderBy(park.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/lodges", async (req, res) => {
  try {
    const parkId = req.query.parkId as string | undefined;
    let query = db.select().from(lodges);
    if (parkId) {
      query = query.where(eq(lodges.park_id, parkId)) as any;
    }
    const rows = await query.orderBy(lodges.lodge_name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/package-types", async (_req, res) => {
  try {
    const rows = await db.select().from(package_type).orderBy(package_type.name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/cottages", async (_req, res) => {
  try {
    const rows = await db.select().from(cottages).orderBy(cottages.cottage_name);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
